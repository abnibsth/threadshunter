from __future__ import annotations

import asyncio
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import (
    get_db,
    get_or_create_bot_settings,
    get_or_create_today_stat,
)
from app.models import DailyStat, LeadPost, Product
from app.schemas import (
    AuthStatusResponse,
    BotStatusResponse,
    DailyStatItem,
    DashboardStatsResponse,
    RawCookieImportRequest,
    ScanTriggerRequest,
    ScanTriggerResponse,
)
from app.services.scheduler import scheduler_service
from app.services.scraper import (
    inspect_auth_state,
    scraper_service,
    validate_and_save_auth_state,
)

router = APIRouter(prefix="/api/bot", tags=["Bot Control"])


def _parse_keywords(raw: str) -> List[str]:
    return [kw.strip() for kw in (raw or "").split(",") if kw.strip()]


@router.get("/status", response_model=BotStatusResponse)
async def get_bot_status(
    db: AsyncSession = Depends(get_db),
) -> BotStatusResponse:
    setting = await get_or_create_bot_settings(db)
    auth_status = inspect_auth_state()

    return BotStatusResponse(
        bot_mode=setting.bot_mode,
        is_scheduler_running=scheduler_service.is_job_active(),
        scan_interval_minutes=setting.scan_interval_minutes,
        next_run_at=scheduler_service.get_next_run_time(),
        is_scanning=scraper_service.is_scanning,
        current_keyword=scraper_service.current_keyword,
        last_scan_at=scraper_service.last_scan_at,
        last_scan_summary=scraper_service.last_scan_summary,
        active_keywords=_parse_keywords(setting.search_keywords),
        ai_provider=setting.ai_provider,
        ai_base_url=setting.ai_base_url,
        ai_model=setting.ai_model,
        has_ai_api_key=bool((setting.ai_api_key or "").strip()),
        min_intent_score=setting.min_intent_score,
        max_comments_per_day=setting.max_comments_per_day,
        auth_status=auth_status,
        recent_logs=scraper_service.recent_logs[:20],
    )


@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
) -> DashboardStatsResponse:
    setting = await get_or_create_bot_settings(db)
    today_stat = await get_or_create_today_stat(db)

    # Lead status totals
    lead_counts_res = await db.execute(
        select(LeadPost.status, func.count(LeadPost.id)).group_by(LeadPost.status)
    )
    lead_counts = {row[0]: int(row[1]) for row in lead_counts_res.all()}

    # Average intent score across buying-intent leads
    avg_score_res = await db.execute(
        select(func.avg(LeadPost.intent_score)).where(LeadPost.is_buying_intent.is_(True))
    )
    avg_score_val = avg_score_res.scalar_one()
    avg_intent_score = round(float(avg_score_val), 1) if avg_score_val is not None else 0.0

    # Product counts
    total_products = int(
        (await db.execute(select(func.count(Product.id)))).scalar_one()
    )
    active_products = int(
        (
            await db.execute(
                select(func.count(Product.id)).where(Product.is_active.is_(True))
            )
        ).scalar_one()
    )

    # Last 7 days daily stats
    history_res = await db.execute(
        select(DailyStat).order_by(DailyStat.date_str.desc()).limit(7)
    )
    history_rows = list(reversed(history_res.scalars().all()))

    return DashboardStatsResponse(
        date_str=today_stat.date_str,
        posts_scraped=today_stat.posts_scraped,
        leads_found=today_stat.leads_found,
        comments_sent=today_stat.comments_sent,
        max_comments_per_day=setting.max_comments_per_day,
        pending_review_count=lead_counts.get("PENDING_REVIEW", 0),
        commented_total_count=lead_counts.get("COMMENTED", 0),
        ignored_total_count=lead_counts.get("IGNORED", 0),
        failed_total_count=lead_counts.get("FAILED", 0),
        total_products=total_products,
        active_products=active_products,
        avg_intent_score=avg_intent_score,
        history=[DailyStatItem.model_validate(item) for item in history_rows],
    )


@router.post("/scheduler/start", response_model=BotStatusResponse)
async def start_bot_scheduler(
    db: AsyncSession = Depends(get_db),
) -> BotStatusResponse:
    setting = await get_or_create_bot_settings(db)
    setting.is_scheduler_running = True
    await db.commit()
    await db.refresh(setting)

    scheduler_service.start(setting.scan_interval_minutes)
    return await get_bot_status(db)


@router.post("/scheduler/stop", response_model=BotStatusResponse)
async def stop_bot_scheduler(
    db: AsyncSession = Depends(get_db),
) -> BotStatusResponse:
    setting = await get_or_create_bot_settings(db)
    setting.is_scheduler_running = False
    await db.commit()
    await db.refresh(setting)

    scheduler_service.stop()
    return await get_bot_status(db)


@router.post("/scan", response_model=ScanTriggerResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_manual_scan(
    payload: Optional[ScanTriggerRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> ScanTriggerResponse:
    setting = await get_or_create_bot_settings(db)

    if scraper_service.is_scanning:
        return ScanTriggerResponse(
            started=False,
            message="Scan sudah sedang berjalan. Pantau progresnya di Live Activity Feed.",
            keywords=_parse_keywords(setting.search_keywords),
        )

    auth_status = inspect_auth_state()
    if not auth_status.connected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Threads session belum terhubung. Upload auth_threads.json terlebih dahulu di halaman Settings.",
        )

    keywords = (
        [k.strip() for k in payload.keywords if k.strip()]
        if payload and payload.keywords
        else _parse_keywords(setting.search_keywords)
    )
    if not keywords:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Belum ada search keyword aktif. Tambahkan keyword di halaman Settings.",
        )

    asyncio.create_task(scraper_service.run_full_scan(keywords_override=keywords))

    return ScanTriggerResponse(
        started=True,
        message=f"Manual scan dimulai untuk {len(keywords)} keyword.",
        keywords=keywords,
    )


@router.get("/auth-status", response_model=AuthStatusResponse)
async def get_auth_status() -> AuthStatusResponse:
    return inspect_auth_state()


@router.post("/upload-auth", response_model=AuthStatusResponse)
async def upload_auth_state(
    file: UploadFile = File(..., description="Playwright auth_threads.json file"),
) -> AuthStatusResponse:
    if not file.filename or not file.filename.lower().endswith(".json"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File harus berformat .json (auth_threads.json).",
        )

    raw_bytes = await file.read()
    if len(raw_bytes) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Ukuran file melebihi batas maksimal 5MB.",
        )

    try:
        auth_status = validate_and_save_auth_state(raw_bytes)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    scraper_service.add_log(
        "success",
        f"Uploaded new auth_threads.json ({auth_status.threads_cookie_count} Threads cookies verified).",
    )
    return auth_status


@router.post("/import-cookies", response_model=AuthStatusResponse)
async def import_cookies_from_json(
    payload: RawCookieImportRequest,
) -> AuthStatusResponse:
    raw_bytes = payload.raw_json.strip().encode("utf-8")
    if len(raw_bytes) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Ukuran data cookie melebihi batas maksimal 5MB.",
        )

    try:
        auth_status = validate_and_save_auth_state(raw_bytes)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    scraper_service.add_log(
        "success",
        f"Connected Chrome session via JSON paste ({auth_status.threads_cookie_count} Threads cookies verified).",
    )
    return auth_status

