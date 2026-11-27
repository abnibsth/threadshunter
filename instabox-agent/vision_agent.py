from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, List, Optional

from openai import AsyncOpenAI

from desktop_driver import InstaBoxDesktopDriver, ScreenCapture

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[str, Optional[bytes]], Awaitable[None]]

SYSTEM_PROMPT = """
Kamu adalah AI Computer-Use Agent yang mengoperasikan desktop Linux Chromium milik user di InstaBox.
Di Chromium tersebut biasanya sudah terbuka tab Shopee Affiliate (`affiliate.shopee.co.id`) milik user dan tab Threads (`threads.com`).

ATURAN KERJA & KEAMANAN KETAT:
1. KOORDINAT: Semua koordinat `x` dan `y` WAJIB memakai skala normalisasi `0` sampai `1000` (0,0 = pojok kiri atas layar; 1000,1000 = pojok kanan bawah layar).
2. LINK SHOPEE AFFILIATE MILIK USER:
   - JANGAN PERNAH mengarang link `s.shopee.co.id`.
   - Untuk mengambil link affiliate resmi akun user, klik tombol "Buat Link" di tab Shopee Affiliate -> klik "Salin Link" -> lalu panggil aksi `read_clipboard` agar kamu mendapatkan teks URL asli secara akurat ke memori kamu!
3. GAYA BALASAN THREADS (BAHASA INDONESIA NATURAL):
   - Jika diminta membalas postingan Threads, gunakan gaya teman sebaya yang santai ("gua", "kemarin ambil ini", "so far awet", "kalau budget segitu").
   - DILARANG memakai bahasa sales kaku seperti "Halo kak", "Yuk diorder", "Cek keranjang kuning".
4. PROTEKSI ANTI-CAPTCHA / KEAMANAN:
   - Jika muncul CAPTCHA, puzzle geser, verifikasi "verify you are human", atau halaman login/2FA tak terduga, DILARANG mencoba menyelesaikan atau mem-bypass CAPTCHA.
   - Segera pilih action `"need_human"` dan jelaskan kondisinya agar user klik `You're driving` di InstaBox secara manual.
5. BALAS HANYA DENGAN 1 VALID JSON OBJECT (tanpa markdown fence) dengan schema:
{
  "thought": "Analisis singkat apa yang terlihat di layar dan langkah berikutnya",
  "action": "click | double_click | type | key | scroll | read_clipboard | wait | done | need_human",
  "x": 500,
  "y": 300,
  "text": "teks yang ingin diketik (khusus action=type)",
  "key": "Return atau ctrl+l (khusus action=key)",
  "direction": "down atau up (khusus action=scroll)",
  "amount": 5,
  "seconds": 3,
  "summary": "Ringkasan hasil akhir atau pesan untuk user (khusus action=done atau need_human)"
}
""".strip()


@dataclass
class AgentRunResult:
    status: str  # "done" | "need_human" | "stopped" | "max_steps" | "error"
    summary: str
    steps_taken: int
    last_screenshot: Optional[bytes]
    captured_links: List[str]


def _extract_json(raw: str) -> Dict[str, Any]:
    text = (raw or "").strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        text = fenced.group(1).strip()
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        return json.loads(text[start : end + 1])
    raise ValueError(f"Model output bukan JSON valid: {text[:220]}")


class VisionComputerAgent:
    """Runs a visual observe -> think -> act loop on the live InstaBox Chromium desktop."""

    def __init__(
        self,
        *,
        driver: InstaBoxDesktopDriver,
        api_key: str,
        base_url: str,
        model: str,
        max_steps: int = 25,
    ) -> None:
        self.driver = driver
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self.max_steps = max_steps

    async def _ask_vision_model(
        self,
        *,
        client: AsyncOpenAI,
        goal: str,
        capture: ScreenCapture,
        history: List[str],
        captured_links: List[str],
        step_num: int,
    ) -> Dict[str, Any]:
        history_block = "\n".join(history[-10:]) if history else "(belum ada aksi)"
        links_block = (
            "\n".join(f"- {lnk}" for lnk in captured_links)
            if captured_links
            else "(belum ada link tersalin di clipboard)"
        )

        user_text = (
            f"MISI USER:\n{goal}\n\n"
            f"Langkah saat ini: {step_num}/{self.max_steps}\n"
            f"Ukuran layar asli: {capture.width}x{capture.height} (gunakan koordinat normalisasi 0..1000)\n\n"
            f"Link Shopee Affiliate yang sudah berhasil kamu salin:\n{links_block}\n\n"
            f"Riwayat aksi terakhir:\n{history_block}\n\n"
            "Lihat screenshot layar saat ini dan tentukan 1 aksi terbaik berikutnya dalam format JSON."
        )

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_text},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{capture.base64_jpeg}",
                        },
                    },
                ],
            },
        ]

        try:
            resp = await client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.2,
                response_format={"type": "json_object"},
            )
        except Exception:
            resp = await client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.2,
            )

        raw = resp.choices[0].message.content or ""
        return _extract_json(raw)

    async def run(
        self,
        goal: str,
        *,
        stop_event: asyncio.Event,
        on_progress: Optional[ProgressCallback] = None,
    ) -> AgentRunResult:
        history: List[str] = []
        captured_links: List[str] = []
        last_bytes: Optional[bytes] = None

        client = AsyncOpenAI(
            api_key=self.api_key or "ollama",
            base_url=self.base_url or None,
            timeout=60.0,
        )

        try:
            for step in range(1, self.max_steps + 1):
                if stop_event.is_set():
                    return AgentRunResult(
                        status="stopped",
                        summary="Misi dihentikan oleh user (/stop).",
                        steps_taken=step - 1,
                        last_screenshot=last_bytes,
                        captured_links=captured_links,
                    )

                capture = await asyncio.to_thread(self.driver.screenshot)
                last_bytes = capture.jpeg_bytes

                decision = await self._ask_vision_model(
                    client=client,
                    goal=goal,
                    capture=capture,
                    history=history,
                    captured_links=captured_links,
                    step_num=step,
                )

                action = str(decision.get("action", "wait")).strip().lower()
                thought = str(decision.get("thought", "")).strip()
                summary = str(decision.get("summary", "")).strip()

                logger.info("[Step %d] action=%s | %s", step, action, thought)

                if action == "done":
                    final_cap = await asyncio.to_thread(self.driver.screenshot)
                    return AgentRunResult(
                        status="done",
                        summary=summary or thought or "Misi selesai dilaksanakan.",
                        steps_taken=step,
                        last_screenshot=final_cap.jpeg_bytes,
                        captured_links=captured_links,
                    )

                if action == "need_human":
                    return AgentRunResult(
                        status="need_human",
                        summary=summary
                        or thought
                        or "Butuh bantuan manual di layar InstaBox (misal CAPTCHA/verifikasi).",
                        steps_taken=step,
                        last_screenshot=capture.jpeg_bytes,
                        captured_links=captured_links,
                    )

                # Execute GUI action on InstaBox X11 desktop
                exec_note = ""
                if action in {"click", "double_click"}:
                    x = float(decision.get("x", 500))
                    y = float(decision.get("y", 500))
                    exec_note = await asyncio.to_thread(
                        self.driver.click,
                        x,
                        y,
                        capture.width,
                        capture.height,
                        action == "double_click",
                    )
                elif action == "type":
                    text_val = str(decision.get("text", ""))
                    exec_note = await asyncio.to_thread(self.driver.type_text, text_val)
                elif action == "key":
                    key_val = str(decision.get("key", "Return"))
                    exec_note = await asyncio.to_thread(self.driver.press_key, key_val)
                elif action == "scroll":
                    direction = str(decision.get("direction", "down"))
                    amount = int(decision.get("amount", 5))
                    exec_note = await asyncio.to_thread(self.driver.scroll, direction, amount)
                elif action == "read_clipboard":
                    clip = await asyncio.to_thread(self.driver.read_clipboard)
                    exec_note = f"clipboard='{clip[:120]}'"
                    if clip and ("shopee.co.id" in clip.lower() or "shp.ee" in clip.lower()):
                        if clip not in captured_links:
                            captured_links.append(clip)
                elif action == "wait":
                    secs = max(1, min(10, int(decision.get("seconds", 3))))
                    await asyncio.sleep(secs)
                    exec_note = f"wait({secs}s)"
                else:
                    await asyncio.sleep(1.5)
                    exec_note = f"unknown({action})"

                history.append(f"Step {step}: [{action}] {exec_note} — {thought[:120]}")

                if on_progress and (step == 1 or step % 4 == 0):
                    await on_progress(f"Langkah {step}/{self.max_steps}: {thought[:160]}", None)

                # Short human settle delay after each action
                await asyncio.sleep(1.4)

            final_cap = await asyncio.to_thread(self.driver.screenshot)
            return AgentRunResult(
                status="max_steps",
                summary=f"Batas maksimal {self.max_steps} langkah tercapai. Kirim prompt lanjutan jika masih perlu diteruskan.",
                steps_taken=self.max_steps,
                last_screenshot=final_cap.jpeg_bytes,
                captured_links=captured_links,
            )
        except Exception as exc:
            logger.exception("Vision agent crashed: %s", exc)
            return AgentRunResult(
                status="error",
                summary=f"Terjadi kendala pada agent: {exc}",
                steps_taken=len(history),
                last_screenshot=last_bytes,
                captured_links=captured_links,
            )
        finally:
            await client.close()
