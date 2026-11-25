from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import settings
from app.services.scraper import scraper_service

logger = logging.getLogger(__name__)

SCAN_JOB_ID = "threads_periodic_scan"


class BotSchedulerService:
    """Manages APScheduler periodic scraping jobs without container restarts."""

    def __init__(self) -> None:
        self._scheduler = AsyncIOScheduler(timezone=settings.TZ)
        self._started = False

    def _ensure_started(self) -> None:
        if not self._started:
            self._scheduler.start()
            self._started = True

    async def _periodic_job(self) -> None:
        logger.info("APScheduler triggered periodic Threads keyword scan.")
        await scraper_service.run_full_scan()

    def start(self, interval_minutes: int) -> Optional[datetime]:
        self._ensure_started()
        safe_interval = max(5, int(interval_minutes))
        self._scheduler.add_job(
            self._periodic_job,
            trigger=IntervalTrigger(minutes=safe_interval),
            id=SCAN_JOB_ID,
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        scraper_service.add_log(
            "success", f"Auto-scheduler started (interval: every {safe_interval} min)."
        )
        return self.get_next_run_time()

    def stop(self) -> None:
        if self._started and self._scheduler.get_job(SCAN_JOB_ID) is not None:
            self._scheduler.remove_job(SCAN_JOB_ID)
            scraper_service.add_log("info", "Auto-scheduler stopped.")

    def reschedule(self, interval_minutes: int) -> Optional[datetime]:
        if not self.is_job_active():
            return None
        safe_interval = max(5, int(interval_minutes))
        self._scheduler.reschedule_job(
            SCAN_JOB_ID,
            trigger=IntervalTrigger(minutes=safe_interval),
        )
        scraper_service.add_log(
            "info", f"Auto-scheduler interval updated live to every {safe_interval} min."
        )
        return self.get_next_run_time()

    def is_job_active(self) -> bool:
        return self._started and self._scheduler.get_job(SCAN_JOB_ID) is not None

    def get_next_run_time(self) -> Optional[datetime]:
        if not self._started:
            return None
        job = self._scheduler.get_job(SCAN_JOB_ID)
        return job.next_run_time if job is not None else None

    def shutdown(self) -> None:
        if self._started:
            self._scheduler.shutdown(wait=False)
            self._started = False


scheduler_service = BotSchedulerService()
