from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import AsyncSessionLocal, get_or_create_bot_settings, init_db
from app.routers import bot_control, leads, products, settings as settings_router
from app.services.scheduler import scheduler_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    logger.info("Initializing Threads Affiliate AI Hunter backend...")
    await init_db()

    # Restore APScheduler job if it was enabled before container restart
    async with AsyncSessionLocal() as session:
        bot_setting = await get_or_create_bot_settings(session)
        if bot_setting.is_scheduler_running:
            scheduler_service.start(bot_setting.scan_interval_minutes)
            logger.info(
                "Restored running scheduler (interval=%dm).",
                bot_setting.scan_interval_minutes,
            )

    yield

    logger.info("Shutting down scheduler...")
    scheduler_service.shutdown()


app = FastAPI(
    title="Threads Affiliate AI Hunter API",
    description="Autonomous Threads buying-intent scraper, universal multi-LLM evaluator, and Shopee Affiliate reply studio.",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(leads.router)
app.include_router(settings_router.router)
app.include_router(bot_control.router)


@app.get("/api/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "threads-affiliate-backend"}
