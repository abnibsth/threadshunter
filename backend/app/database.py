from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import AsyncGenerator
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models import Base, BotSetting, DailyStat, Product

logger = logging.getLogger(__name__)

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an async SQLAlchemy session."""
    async with AsyncSessionLocal() as session:
        yield session


def today_date_str() -> str:
    """Return today's YYYY-MM-DD string in configured Jakarta timezone."""
    try:
        tz = ZoneInfo(settings.TZ)
    except Exception:
        tz = ZoneInfo("Asia/Jakarta")
    return datetime.now(tz).strftime("%Y-%m-%d")


async def get_or_create_bot_settings(session: AsyncSession) -> BotSetting:
    """Fetch singleton BotSetting row (id=1), creating defaults if missing."""
    row = await session.get(BotSetting, 1)
    if row is None:
        row = BotSetting(id=1)
        session.add(row)
        await session.commit()
        await session.refresh(row)
    return row


async def get_or_create_today_stat(session: AsyncSession) -> DailyStat:
    """Fetch today's DailyStat row, initializing counters to 0 if missing."""
    date_key = today_date_str()
    stat = await session.get(DailyStat, date_key)
    if stat is None:
        stat = DailyStat(
            date_str=date_key,
            posts_scraped=0,
            leads_found=0,
            comments_sent=0,
        )
        session.add(stat)
        await session.commit()
        await session.refresh(stat)
    return stat


async def init_db() -> None:
    """Create PostgreSQL tables and seed initial products & bot_settings."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # 1. Ensure singleton bot_settings row exists
        await get_or_create_bot_settings(session)

        # 2. Ensure today's daily_stats row exists
        await get_or_create_today_stat(session)

        # 3. Seed products from seed_products.json only when table is empty
        count_result = await session.execute(select(func.count()).select_from(Product))
        product_count = count_result.scalar_one()

        if product_count == 0:
            seed_path = settings.seed_products_file
            if seed_path.exists():
                try:
                    raw = json.loads(seed_path.read_text(encoding="utf-8"))
                    if isinstance(raw, list):
                        for item in raw:
                            session.add(
                                Product(
                                    name=item["name"],
                                    category=item.get("category", "General"),
                                    keywords=item.get("keywords", ""),
                                    price_range=item.get("price_range", ""),
                                    selling_points=item.get("selling_points", ""),
                                    affiliate_link=item["affiliate_link"],
                                    is_active=bool(item.get("is_active", True)),
                                )
                            )
                        await session.commit()
                        logger.info("Seeded %d initial Shopee affiliate products.", len(raw))
                except Exception as exc:
                    await session.rollback()
                    logger.warning("Failed to seed products from %s: %s", seed_path, exc)
            else:
                logger.info("Seed file not found at %s; skipping product seed.", seed_path)
