from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence

from openai import AsyncOpenAI

from app.models import BotSetting, DEFAULT_SYSTEM_PROMPT, Product

logger = logging.getLogger(__name__)


@dataclass
class AIEvaluationResult:
    is_buying_intent: bool
    intent_score: int
    matched_product_id: Optional[int]
    matched_product_name: Optional[str]
    reasoning: str
    draft_reply: str
    latency_ms: int
    provider_used: str
    model_used: str


class AIServiceError(RuntimeError):
    """Raised when an AI provider call fails or returns unusable output."""


def _is_local_endpoint(base_url: str) -> bool:
    lowered = (base_url or "").lower()
    return any(host in lowered for host in ("localhost", "127.0.0.1", "host.docker.internal", "ollama"))


def _build_catalog_context(products: Sequence[Product]) -> str:
    if not products:
        return "[]"

    catalog_items: List[Dict[str, Any]] = []
    for p in products:
        catalog_items.append(
            {
                "id": p.id,
                "name": p.name,
                "category": p.category,
                "keywords": p.keywords,
                "price_range": p.price_range,
                "selling_points": p.selling_points,
                "affiliate_link": p.affiliate_link,
            }
        )
    return json.dumps(catalog_items, ensure_ascii=False, indent=2)


def _build_system_prompt(custom_prompt: Optional[str]) -> str:
    persona = (custom_prompt or "").strip() or DEFAULT_SYSTEM_PROMPT
    return (
        f"{persona}\n\n"
        "STRICT OUTPUT & TONE RULES:\n"
        "1. Evaluasi apakah postingan Threads ini menunjukkan niat beli / sedang mencari rekomendasi produk / minta spill link.\n"
        "2. Cocokkan HANYA dengan produk aktif dari katalog JSON yang diberikan. Jika tidak ada yang cocok, set matched_product_id ke null dan is_buying_intent ke false (atau intent_score rendah).\n"
        "3. Gaya bahasa `draft_reply` WAJIB seperti teman Indonesia di Threads yang santai dan jujur ('gua', 'kemarin ambil ini', 'so far awet', 'kalau budget segitu').\n"
        "4. DILARANG KERAS memakai kata/frasa jualan kaku: 'Halo kak', 'Yuk diorder', 'Cek keranjang kuning', 'Buruan checkout', 'Ready stok kak'.\n"
        "5. Jika matched_product_id terisi, wajib sertakan `affiliate_link` produk tersebut secara natural di akhir atau tengah kalimat.\n"
        "6. Balas HANYA dengan valid JSON object tanpa markdown fence atau penjelasan tambahan dengan struktur tepat:\n"
        "{\n"
        '  "is_buying_intent": true,\n'
        '  "intent_score": 90,\n'
        '  "matched_product_id": 1,\n'
        '  "reasoning": "Penjelasan singkat alasan skor & kecocokan produk.",\n'
        '  "draft_reply": "Balasan kasual bahasa Indonesia + affiliate_link"\n'
        "}"
    )


def _build_user_prompt(post_text: str, products: Sequence[Product], keyword: Optional[str] = None) -> str:
    catalog_json = _build_catalog_context(products)
    kw_line = f"Search keyword matched: {keyword}\n" if keyword else ""
    return (
        f"Katalog Produk Shopee Affiliate Aktif:\n{catalog_json}\n\n"
        f"{kw_line}"
        f"Postingan Threads untuk dievaluasi:\n\"\"\"\n{post_text.strip()}\n\"\"\"\n\n"
        "Kembalikan HANYA JSON valid sesuai schema."
    )


def _extract_json_object(raw_text: str) -> Dict[str, Any]:
    text = (raw_text or "").strip()
    if not text:
        raise AIServiceError("AI returned an empty response.")

    # Strip ```json ... ``` fences if present
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        text = fenced.group(1).strip()

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Fallback: locate outermost JSON braces
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = text[start : end + 1]
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError as exc:
            raise AIServiceError(f"Failed to parse JSON from AI output: {exc}") from exc

    raise AIServiceError(f"AI output did not contain a valid JSON object: {text[:240]}")


async def _call_openai_compatible(
    *,
    api_key: str,
    base_url: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
) -> str:
    effective_key = api_key.strip()
    if not effective_key:
        if _is_local_endpoint(base_url):
            effective_key = "ollama"
        else:
            raise AIServiceError(
                "AI API Key belum dikonfigurasi. Masukkan API Key terlebih dahulu di halaman Settings."
            )

    normalized_base_url = (base_url or "").strip() or None
    client = AsyncOpenAI(
        api_key=effective_key,
        base_url=normalized_base_url,
        timeout=45.0,
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.4,
                response_format={"type": "json_object"},
            )
        except Exception as fmt_exc:
            # Some OpenAI-compatible routers or open-source models reject response_format
            logger.debug("Retrying chat completion without response_format: %s", fmt_exc)
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.4,
            )

        if not response.choices:
            raise AIServiceError("AI provider returned no completion choices.")
        content = response.choices[0].message.content or ""
        return content
    except AIServiceError:
        raise
    except Exception as exc:
        raise AIServiceError(f"OpenAI-compatible request failed: {exc}") from exc
    finally:
        await client.close()


async def _call_google_genai(
    *,
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
) -> str:
    effective_key = api_key.strip()
    if not effective_key:
        raise AIServiceError(
            "Google Gemini API Key belum dikonfigurasi. Masukkan API Key di halaman Settings."
        )

    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise AIServiceError(
            "Library 'google-genai' tidak terpasang di environment backend."
        ) from exc

    def _invoke() -> str:
        client = genai.Client(api_key=effective_key)
        response = client.models.generate_content(
            model=model,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.4,
                response_mime_type="application/json",
            ),
        )
        return response.text or ""

    try:
        return await asyncio.to_thread(_invoke)
    except Exception as exc:
        raise AIServiceError(f"Native google-genai request failed: {exc}") from exc


async def evaluate_post(
    *,
    post_text: str,
    products: Sequence[Product],
    bot_setting: BotSetting,
    keyword: Optional[str] = None,
    override_provider: Optional[str] = None,
    override_base_url: Optional[str] = None,
    override_api_key: Optional[str] = None,
    override_model: Optional[str] = None,
    override_system_prompt: Optional[str] = None,
) -> AIEvaluationResult:
    """Evaluate a Threads post against active Shopee Affiliate products using the configured LLM."""
    provider = (override_provider or bot_setting.ai_provider or "openai_compatible").strip()
    base_url = (
        override_base_url
        if override_base_url is not None and override_base_url.strip() != ""
        else bot_setting.ai_base_url
    )
    api_key = (
        override_api_key
        if override_api_key is not None and override_api_key.strip() != ""
        else bot_setting.ai_api_key
    )
    model = (
        override_model
        if override_model is not None and override_model.strip() != ""
        else bot_setting.ai_model
    )
    custom_prompt = (
        override_system_prompt
        if override_system_prompt is not None and override_system_prompt.strip() != ""
        else bot_setting.custom_system_prompt
    )

    if not model:
        raise AIServiceError("AI Model name tidak boleh kosong.")

    system_prompt = _build_system_prompt(custom_prompt)
    user_prompt = _build_user_prompt(post_text, products, keyword=keyword)

    started_at = time.perf_counter()
    if provider == "google_genai":
        raw_output = await _call_google_genai(
            api_key=api_key,
            model=model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )
    else:
        raw_output = await _call_openai_compatible(
            api_key=api_key,
            base_url=base_url,
            model=model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

    latency_ms = int((time.perf_counter() - started_at) * 1000)
    payload = _extract_json_object(raw_output)

    # Validate & sanitize parsed values
    product_map = {p.id: p for p in products}
    raw_product_id = payload.get("matched_product_id")
    matched_product_id: Optional[int] = None
    matched_product_name: Optional[str] = None

    if raw_product_id is not None:
        try:
            candidate_id = int(raw_product_id)
            if candidate_id in product_map:
                matched_product_id = candidate_id
                matched_product_name = product_map[candidate_id].name
        except (TypeError, ValueError):
            matched_product_id = None

    try:
        intent_score = int(round(float(payload.get("intent_score", 0))))
    except (TypeError, ValueError):
        intent_score = 0
    intent_score = max(0, min(100, intent_score))

    is_buying_intent = bool(payload.get("is_buying_intent", False))
    reasoning = str(payload.get("reasoning", "")).strip()
    draft_reply = str(payload.get("draft_reply", "")).strip()

    # Ensure matched product affiliate link is present in draft_reply when buying intent is true
    if is_buying_intent and matched_product_id is not None and draft_reply:
        product = product_map[matched_product_id]
        if product.affiliate_link and product.affiliate_link not in draft_reply:
            draft_reply = f"{draft_reply} {product.affiliate_link}".strip()

    return AIEvaluationResult(
        is_buying_intent=is_buying_intent,
        intent_score=intent_score,
        matched_product_id=matched_product_id,
        matched_product_name=matched_product_name,
        reasoning=reasoning,
        draft_reply=draft_reply,
        latency_ms=latency_ms,
        provider_used=provider,
        model_used=model,
    )
