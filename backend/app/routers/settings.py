from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, get_or_create_bot_settings
from app.models import BotSetting, Product
from app.schemas import (
    BotSettingResponse,
    BotSettingUpdate,
    TestAIRequest,
    TestAIResponse,
)
from app.services.ai_service import AIServiceError, evaluate_post
from app.services.scheduler import scheduler_service

router = APIRouter(prefix="/api/settings", tags=["Settings"])


def _mask_secret(secret: str | None) -> str:
    value = (secret or "").strip()
    if not value:
        return ""
    if len(value) <= 8:
        return "•" * len(value)
    return f"{value[:4]}••••••••{value[-4:]}"


def _serialize_settings(row: BotSetting) -> BotSettingResponse:
    return BotSettingResponse(
        id=row.id,
        bot_mode=row.bot_mode,
        is_scheduler_running=row.is_scheduler_running,
        scan_interval_minutes=row.scan_interval_minutes,
        max_comments_per_day=row.max_comments_per_day,
        min_intent_score=row.min_intent_score,
        search_keywords=row.search_keywords,
        ai_provider=row.ai_provider,
        ai_base_url=row.ai_base_url,
        has_ai_api_key=bool((row.ai_api_key or "").strip()),
        ai_api_key_masked=_mask_secret(row.ai_api_key),
        ai_model=row.ai_model,
        custom_system_prompt=row.custom_system_prompt,
        has_telegram_bot_token=bool((row.telegram_bot_token or "").strip()),
        telegram_bot_token_masked=_mask_secret(row.telegram_bot_token),
        telegram_chat_id=row.telegram_chat_id,
    )


@router.get("", response_model=BotSettingResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
) -> BotSettingResponse:
    row = await get_or_create_bot_settings(db)
    return _serialize_settings(row)


@router.patch("", response_model=BotSettingResponse)
@router.put("", response_model=BotSettingResponse)
async def update_settings(
    payload: BotSettingUpdate,
    db: AsyncSession = Depends(get_db),
) -> BotSettingResponse:
    row = await get_or_create_bot_settings(db)
    previous_interval = row.scan_interval_minutes

    updates = payload.model_dump(exclude_unset=True)

    # Preserve existing secrets when form submits blank string
    if "ai_api_key" in updates:
        raw_key = (updates["ai_api_key"] or "").strip()
        if not raw_key:
            updates.pop("ai_api_key")
        else:
            updates["ai_api_key"] = raw_key

    if "telegram_bot_token" in updates:
        raw_token = (updates["telegram_bot_token"] or "").strip()
        if not raw_token:
            updates.pop("telegram_bot_token")
        else:
            updates["telegram_bot_token"] = raw_token

    if "search_keywords" in updates and updates["search_keywords"] is not None:
        cleaned = ", ".join(
            kw.strip() for kw in updates["search_keywords"].split(",") if kw.strip()
        )
        updates["search_keywords"] = cleaned

    for field_name, value in updates.items():
        setattr(row, field_name, value)

    await db.commit()
    await db.refresh(row)

    # Reschedule APScheduler live if interval changed while scheduler is active
    if row.is_scheduler_running and row.scan_interval_minutes != previous_interval:
        scheduler_service.reschedule(row.scan_interval_minutes)

    return _serialize_settings(row)


@router.post("/test-ai", response_model=TestAIResponse)
async def test_ai_connection(
    payload: TestAIRequest,
    db: AsyncSession = Depends(get_db),
) -> TestAIResponse:
    bot_setting = await get_or_create_bot_settings(db)

    result = await db.execute(
        select(Product).where(Product.is_active.is_(True)).order_by(Product.id.asc())
    )
    active_products = list(result.scalars().all())

    try:
        evaluation = await evaluate_post(
            post_text=payload.sample_post,
            products=active_products,
            bot_setting=bot_setting,
            override_provider=payload.ai_provider,
            override_base_url=payload.ai_base_url,
            override_api_key=payload.ai_api_key,
            override_model=payload.ai_model,
            override_system_prompt=payload.custom_system_prompt,
        )
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return TestAIResponse(
        is_buying_intent=evaluation.is_buying_intent,
        intent_score=evaluation.intent_score,
        matched_product_id=evaluation.matched_product_id,
        matched_product_name=evaluation.matched_product_name,
        reasoning=evaluation.reasoning,
        draft_reply=evaluation.draft_reply,
        latency_ms=evaluation.latency_ms,
        provider_used=evaluation.provider_used,
        model_used=evaluation.model_used,
    )
