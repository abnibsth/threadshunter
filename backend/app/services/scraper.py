from __future__ import annotations

import asyncio
import json
import logging
import random
import urllib.parse
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional

from playwright.async_api import Browser, BrowserContext, Page, async_playwright
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import (
    AsyncSessionLocal,
    get_or_create_bot_settings,
    get_or_create_today_stat,
)
from app.models import BotSetting, LeadPost, Product
from app.schemas import ActivityLogItem, AuthStatusResponse
from app.services.ai_service import AIServiceError, evaluate_post
from app.services.telegram import notify_new_lead, notify_reply_sent

logger = logging.getLogger(__name__)

STEALTH_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

STEALTH_INIT_SCRIPT = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'id', 'en-US', 'en'] });
window.chrome = window.chrome || { runtime: {} };
"""

EXTRACT_POSTS_JS = r"""
() => {
  const links = Array.from(document.querySelectorAll('a[href*="/post/"]'));
  const seen = new Set();
  const results = [];

  for (const link of links) {
    const href = link.getAttribute('href') || '';
    const match = href.match(/\/@?([^\/]+)\/post\/([A-Za-z0-9_-]+)/) || href.match(/\/post\/([A-Za-z0-9_-]+)/);
    if (!match) continue;

    const hasAuthorInHref = match.length === 3;
    const authorFromHref = hasAuthorInHref ? match[1].replace(/^@/, '') : '';
    const shortcode = hasAuthorInHref ? match[2] : match[1];

    if (!shortcode || seen.has(shortcode)) continue;

    // Walk up DOM to find the enclosing post container
    let container = link;
    for (let i = 0; i < 8 && container && container.parentElement; i++) {
      const parent = container.parentElement;
      const textLen = (parent.innerText || '').trim().length;
      const postLinksInParent = parent.querySelectorAll('a[href*="/post/"]').length;
      if (textLen >= 30 && postLinksInParent <= 3) {
        container = parent;
        if (textLen >= 60) break;
      } else {
        container = parent;
      }
    }

    const rawText = (container && container.innerText ? container.innerText : '').trim();
    const lines = rawText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !/^(Like|Reply|Repost|Share|Balas|Suka|Bagikan|\d+[hmdws]?)$/i.test(l));

    let author = authorFromHref;
    if (!author && container) {
      const profileLink = container.querySelector('a[href^="/@"]');
      if (profileLink) {
        const pHref = profileLink.getAttribute('href') || '';
        const pMatch = pHref.match(/^\/@([^\/\?]+)/);
        if (pMatch) author = pMatch[1];
      }
    }

    // Strip leading author line / timestamps from body text
    const filteredLines = lines.filter((line, idx) => {
      if (idx === 0 && author && line.replace(/^@/, '').toLowerCase() === author.toLowerCase()) {
        return false;
      }
      if (/^\d+\s?(m|h|d|w|j|mnt|jam|hari)$/i.test(line)) {
        return false;
      }
      return true;
    });

    const postText = filteredLines.join(' ').replace(/\s+/g, ' ').trim();
    if (postText.length < 15) continue;

    seen.add(shortcode);
    const fullUrl = href.startsWith('http')
      ? href.split('?')[0]
      : `${window.location.origin}${href.split('?')[0]}`;

    results.push({
      shortcode,
      post_url: fullUrl,
      author_username: author || 'threads_user',
      post_text: postText.slice(0, 1500),
    });
  }

  return results;
}
"""


@dataclass
class ScrapedRawPost:
    shortcode: str
    post_url: str
    author_username: str
    post_text: str


def _is_threads_cookie(cookie: Dict[str, Any]) -> bool:
    domain = str(cookie.get("domain", "")).lower().strip()
    return (
        domain.endswith("threads.net")
        or domain.endswith("threads.com")
        or "threads.net" in domain
        or "threads.com" in domain
    )


def inspect_auth_state(auth_path: Optional[Path] = None) -> AuthStatusResponse:
    """Inspect backend/data/auth_threads.json and report session connectivity."""
    target = auth_path or settings.auth_state_file
    if not target.exists():
        return AuthStatusResponse(
            connected=False,
            cookie_count=0,
            threads_cookie_count=0,
            has_session_cookie=False,
            updated_at=None,
            message="File auth_threads.json belum ditemukan. Upload session dari halaman Settings.",
        )

    try:
        stat = target.stat()
        updated_at = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
        data = json.loads(target.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or not isinstance(data.get("cookies"), list):
            return AuthStatusResponse(
                connected=False,
                cookie_count=0,
                threads_cookie_count=0,
                has_session_cookie=False,
                updated_at=updated_at,
                message="Format auth_threads.json tidak valid (field 'cookies' tidak ditemukan).",
            )

        cookies = [c for c in data["cookies"] if isinstance(c, dict)]
        threads_cookies = [c for c in cookies if _is_threads_cookie(c)]
        session_cookie_names = {"sessionid", "ds_user_id", "csrftoken", "ig_did"}
        has_session_cookie = any(
            str(c.get("name", "")).lower() in session_cookie_names for c in threads_cookies
        )
        connected = len(threads_cookies) > 0

        if connected and has_session_cookie:
            msg = f"Connected ({len(threads_cookies)} Threads cookies aktif)."
        elif connected:
            msg = f"Connected ({len(threads_cookies)} cookies terdeteksi — pastikan sudah login)."
        else:
            msg = "Session kosong. Jalankan login_helper.py lalu upload auth_threads.json."

        return AuthStatusResponse(
            connected=connected,
            cookie_count=len(cookies),
            threads_cookie_count=len(threads_cookies),
            has_session_cookie=has_session_cookie,
            updated_at=updated_at,
            message=msg,
        )
    except Exception as exc:
        return AuthStatusResponse(
            connected=False,
            cookie_count=0,
            threads_cookie_count=0,
            has_session_cookie=False,
            updated_at=None,
            message=f"Gagal membaca auth_threads.json: {exc}",
        )


def _normalize_same_site(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if raw in {"strict"}:
        return "Strict"
    if raw in {"none", "no_restriction"}:
        return "None"
    return "Lax"


def _normalize_cookie_item(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    name = str(raw.get("name", "")).strip()
    domain = str(raw.get("domain", "")).strip()
    if not name or not domain:
        return None

    same_site = _normalize_same_site(raw.get("sameSite"))
    secure = bool(raw.get("secure", True))
    if same_site == "None":
        secure = True

    expires_raw = raw.get("expires", raw.get("expirationDate", -1))
    try:
        expires = float(expires_raw) if expires_raw is not None else -1.0
    except (TypeError, ValueError):
        expires = -1.0

    return {
        "name": name,
        "value": str(raw.get("value", "")),
        "domain": domain,
        "path": str(raw.get("path") or "/"),
        "expires": expires,
        "httpOnly": bool(raw.get("httpOnly", False)),
        "secure": secure,
        "sameSite": same_site,
    }


def validate_and_save_auth_state(raw_bytes: bytes, auth_path: Optional[Path] = None) -> AuthStatusResponse:
    """Validate uploaded Playwright storage_state OR Chrome Cookie-Editor JSON and persist it atomically."""
    try:
        decoded = raw_bytes.decode("utf-8")
        parsed = json.loads(decoded)
    except Exception as exc:
        raise ValueError(f"File harus berupa JSON UTF-8 yang valid: {exc}") from exc

    # Support BOTH Playwright storage_state ({cookies: [...], origins: [...]})
    # AND raw Chrome extension exports (Cookie-Editor / EditThisCookie JSON array [...])
    if isinstance(parsed, list):
        raw_cookies = [c for c in parsed if isinstance(c, dict)]
        origins: List[Any] = []
    elif isinstance(parsed, dict) and isinstance(parsed.get("cookies"), list):
        raw_cookies = [c for c in parsed["cookies"] if isinstance(c, dict)]
        origins = parsed.get("origins", []) if isinstance(parsed.get("origins"), list) else []
    else:
        raise ValueError(
            "Struktur JSON tidak valid: gunakan auth_threads.json dari login_helper.py "
            "atau file Export JSON dari ekstensi Chrome Cookie-Editor."
        )

    normalized_cookies = [
        item
        for item in (_normalize_cookie_item(c) for c in raw_cookies)
        if item is not None
    ]
    threads_cookies = [c for c in normalized_cookies if _is_threads_cookie(c)]

    if not threads_cookies:
        raise ValueError(
            "Tidak ditemukan cookie untuk domain .threads.net / .threads.com di dalam file ini. "
            "Pastikan kamu sudah login di threads.com lalu export ulang."
        )

    normalized_state = {
        "cookies": normalized_cookies,
        "origins": origins,
    }

    target = auth_path or settings.auth_state_file
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp_file = target.with_suffix(".json.tmp")
    tmp_file.write_text(json.dumps(normalized_state, indent=2), encoding="utf-8")
    tmp_file.replace(target)

    return inspect_auth_state(target)


class ThreadsScraperService:
    """Playwright stealth Threads scraper & human-emulated responder."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self.is_scanning: bool = False
        self.current_keyword: Optional[str] = None
        self.last_scan_at: Optional[datetime] = None
        self.last_scan_summary: Optional[str] = None
        self._logs: Deque[ActivityLogItem] = deque(maxlen=60)
        self.add_log("info", "Threads Affiliate Engine initialized and standing by.")

    def add_log(self, level: str, message: str) -> None:
        normalized = level if level in ("info", "success", "warning", "error") else "info"
        item = ActivityLogItem(
            timestamp=datetime.now(timezone.utc),
            level=normalized,  # type: ignore[arg-type]
            message=message,
        )
        self._logs.appendleft(item)
        log_fn = getattr(logger, "warning" if normalized == "warning" else normalized, logger.info)
        if normalized == "success":
            log_fn = logger.info
        log_fn("[ThreadsScraper] %s", message)

    @property
    def recent_logs(self) -> List[ActivityLogItem]:
        return list(self._logs)

    async def _launch_stealth_context(self, playwright: Any) -> tuple[Browser, BrowserContext]:
        auth_path = settings.auth_state_file
        auth_status = inspect_auth_state(auth_path)
        if not auth_status.connected:
            raise RuntimeError(
                "Threads session belum terhubung. Upload auth_threads.json yang valid di halaman Settings."
            )

        browser = await playwright.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1366,900",
            ],
        )
        context = await browser.new_context(
            storage_state=str(auth_path),
            locale="id-ID",
            timezone_id="Asia/Jakarta",
            viewport={"width": 1366, "height": 900},
            user_agent=STEALTH_USER_AGENT,
        )
        await context.add_init_script(STEALTH_INIT_SCRIPT)
        return browser, context

    async def _extract_posts_from_search(self, keyword: str) -> List[ScrapedRawPost]:
        encoded_kw = urllib.parse.quote(keyword)
        search_url = (
            f"https://www.threads.com/search?q={encoded_kw}&serp_type=default&filter=recent"
        )

        async with async_playwright() as p:
            browser, context = await self._launch_stealth_context(p)
            try:
                page = await context.new_page()
                await page.goto(search_url, wait_until="domcontentloaded", timeout=45000)

                # Randomized human wait (4-7 seconds)
                await asyncio.sleep(random.uniform(4.0, 7.0))

                # Two natural scrolls to load fresh posts
                for _ in range(2):
                    scroll_px = random.randint(650, 1150)
                    await page.evaluate(f"window.scrollBy({{ top: {scroll_px}, behavior: 'smooth' }})")
                    await asyncio.sleep(random.uniform(2.2, 4.2))

                raw_items: List[Dict[str, str]] = await page.evaluate(EXTRACT_POSTS_JS)
                posts = [
                    ScrapedRawPost(
                        shortcode=item["shortcode"],
                        post_url=item["post_url"],
                        author_username=item["author_username"],
                        post_text=item["post_text"],
                    )
                    for item in raw_items
                    if item.get("shortcode") and item.get("post_text")
                ]
                return posts
            finally:
                await context.close()
                await browser.close()

    async def scrape_keyword(self, keyword: str) -> Dict[str, int]:
        """Scrape a single keyword on Threads, evaluate via AI, store leads, and optionally auto-reply."""
        clean_kw = keyword.strip()
        if not clean_kw:
            return {"scraped": 0, "new_posts": 0, "leads_found": 0, "auto_replied": 0}

        self.current_keyword = clean_kw
        self.add_log("info", f"Scanning Threads recent feed for keyword: '{clean_kw}'")

        raw_posts = await self._extract_posts_from_search(clean_kw)
        summary = {
            "scraped": len(raw_posts),
            "new_posts": 0,
            "leads_found": 0,
            "auto_replied": 0,
        }

        if not raw_posts:
            self.add_log("warning", f"No posts extracted for '{clean_kw}'. Session may need refresh or feed was empty.")
            return summary

        auto_reply_candidates: List[int] = []

        async with AsyncSessionLocal() as session:
            bot_setting = await get_or_create_bot_settings(session)
            today_stat = await get_or_create_today_stat(session)

            # Fetch existing shortcodes for deduplication
            shortcodes = [p.shortcode for p in raw_posts]
            existing_res = await session.execute(
                select(LeadPost.post_shortcode).where(LeadPost.post_shortcode.in_(shortcodes))
            )
            existing_shortcodes = set(existing_res.scalars().all())

            # Load active Shopee affiliate products
            prod_res = await session.execute(
                select(Product).where(Product.is_active.is_(True)).order_by(Product.id.asc())
            )
            active_products = list(prod_res.scalars().all())

            new_posts = [p for p in raw_posts if p.shortcode not in existing_shortcodes]
            today_stat.posts_scraped += len(raw_posts)
            await session.commit()

            summary["new_posts"] = len(new_posts)
            self.add_log(
                "info",
                f"Found {len(raw_posts)} posts ({len(new_posts)} new) for '{clean_kw}'.",
            )

            for raw in new_posts:
                try:
                    evaluation = await evaluate_post(
                        post_text=raw.post_text,
                        products=active_products,
                        bot_setting=bot_setting,
                        keyword=clean_kw,
                    )
                except AIServiceError as ai_exc:
                    self.add_log("error", f"AI evaluation failed for {raw.shortcode}: {ai_exc}")
                    continue

                is_qualified = (
                    evaluation.is_buying_intent
                    and evaluation.intent_score >= bot_setting.min_intent_score
                    and bool(evaluation.draft_reply)
                )
                lead_status = "PENDING_REVIEW" if is_qualified else "IGNORED"

                lead = LeadPost(
                    post_shortcode=raw.shortcode,
                    post_url=raw.post_url,
                    author_username=raw.author_username,
                    post_text=raw.post_text,
                    keyword_matched=clean_kw,
                    intent_score=evaluation.intent_score,
                    is_buying_intent=evaluation.is_buying_intent,
                    ai_reasoning=evaluation.reasoning,
                    matched_product_id=evaluation.matched_product_id,
                    draft_reply=evaluation.draft_reply,
                    status=lead_status,
                )
                session.add(lead)

                if is_qualified:
                    today_stat.leads_found += 1
                    summary["leads_found"] += 1

                await session.commit()
                await session.refresh(lead)

                if is_qualified:
                    self.add_log(
                        "success",
                        f"Matched lead @{lead.author_username} ({lead.intent_score}% intent) -> {evaluation.matched_product_name or 'Catalog'}",
                    )
                    await notify_new_lead(
                        bot_setting, lead, product_name=evaluation.matched_product_name
                    )
                    if bot_setting.bot_mode == "FULL_AUTO":
                        auto_reply_candidates.append(lead.id)

        # Handle FULL_AUTO replies outside the DB transaction with anti-ban randomized cooldown
        for lead_id in auto_reply_candidates:
            async with AsyncSessionLocal() as check_session:
                bot_setting = await get_or_create_bot_settings(check_session)
                today_stat = await get_or_create_today_stat(check_session)
                if today_stat.comments_sent >= bot_setting.max_comments_per_day:
                    self.add_log(
                        "warning",
                        f"Daily comment cap reached ({today_stat.comments_sent}/{bot_setting.max_comments_per_day}). Skipping auto-reply.",
                    )
                    break

            cooldown = random.randint(45, 120)
            self.add_log(
                "info",
                f"FULL_AUTO anti-ban cooldown: waiting {cooldown}s before replying to lead #{lead_id}...",
            )
            await asyncio.sleep(cooldown)
            try:
                await self._send_reply_unlocked(lead_id)
                summary["auto_replied"] += 1
            except Exception as reply_exc:
                self.add_log("error", f"Auto-reply failed for lead #{lead_id}: {reply_exc}")

        return summary

    async def run_full_scan(self, keywords_override: Optional[List[str]] = None) -> Dict[str, Any]:
        """Run a sequential scan across all configured keywords with anti-ban pacing."""
        if self._lock.locked():
            self.add_log("warning", "A scan or reply task is already in progress; skipping overlapping trigger.")
            return {"skipped": True, "reason": "Scraper busy"}

        async with self._lock:
            self.is_scanning = True
            totals = {"scraped": 0, "new_posts": 0, "leads_found": 0, "auto_replied": 0}
            try:
                async with AsyncSessionLocal() as session:
                    bot_setting = await get_or_create_bot_settings(session)
                    if keywords_override:
                        keywords = [k.strip() for k in keywords_override if k.strip()]
                    else:
                        keywords = [
                            k.strip()
                            for k in (bot_setting.search_keywords or "").split(",")
                            if k.strip()
                        ]

                if not keywords:
                    self.add_log("warning", "No search keywords configured. Add keywords in Settings.")
                    return {"skipped": True, "reason": "No keywords configured"}

                for idx, kw in enumerate(keywords):
                    try:
                        res = await self.scrape_keyword(kw)
                        for key in totals:
                            totals[key] += res.get(key, 0)
                    except Exception as kw_exc:
                        self.add_log("error", f"Error scanning '{kw}': {kw_exc}")

                    if idx < len(keywords) - 1:
                        pause = random.uniform(6.0, 14.0)
                        await asyncio.sleep(pause)

                self.last_scan_at = datetime.now(timezone.utc)
                self.last_scan_summary = (
                    f"Scraped {totals['scraped']} posts, {totals['new_posts']} new, "
                    f"{totals['leads_found']} leads matched, {totals['auto_replied']} auto-replied."
                )
                self.add_log("success", f"Scan complete — {self.last_scan_summary}")
                return totals
            finally:
                self.is_scanning = False
                self.current_keyword = None

    async def _type_human_like(self, page: Page, text: str) -> None:
        """Type character-by-character with randomized 45-110ms human keystroke delays."""
        for char in text:
            if char == "\n":
                await page.keyboard.press("Shift+Enter")
            else:
                await page.keyboard.type(char, delay=random.randint(45, 110))

    async def _send_reply_unlocked(self, lead_id: int) -> LeadPost:
        async with AsyncSessionLocal() as session:
            stmt = (
                select(LeadPost)
                .options(selectinload(LeadPost.matched_product))
                .where(LeadPost.id == lead_id)
            )
            result = await session.execute(stmt)
            lead = result.scalar_one_or_none()
            if lead is None:
                raise ValueError(f"Lead #{lead_id} not found.")

            reply_text = (lead.draft_reply or "").strip()
            if not reply_text:
                raise ValueError("Draft reply kosong. Isi teks balasan sebelum mengirim.")

            # Final Commission Protection Guard: ensure reply contains user's own Shopee Affiliate link
            owned_links_res = await session.execute(select(Product.affiliate_link))
            owned_links = [
                lnk.strip()
                for lnk in owned_links_res.scalars().all()
                if lnk and "example-" not in lnk.lower()
            ]
            if not owned_links or not any(lnk in reply_text for lnk in owned_links):
                raise ValueError(
                    "Proteksi Komisi: Balasan dibatalkan karena tidak mengandung link Shopee Affiliate "
                    "resmi milikmu yang terdaftar di menu Products."
                )

            bot_setting = await get_or_create_bot_settings(session)
            today_stat = await get_or_create_today_stat(session)

            if today_stat.comments_sent >= bot_setting.max_comments_per_day:
                raise RuntimeError(
                    f"Batas anti-ban harian tercapai ({today_stat.comments_sent}/{bot_setting.max_comments_per_day} komentar)."
                )

            post_url = lead.post_url

        self.add_log("info", f"Opening Threads post for @{lead.author_username} to send reply...")

        try:
            async with async_playwright() as p:
                browser, context = await self._launch_stealth_context(p)
                try:
                    page = await context.new_page()
                    await page.goto(post_url, wait_until="domcontentloaded", timeout=45000)
                    await asyncio.sleep(random.uniform(3.0, 6.0))

                    # Click Reply / Balas icon button
                    reply_btn = page.locator(
                        '[aria-label="Reply"], [aria-label="Balas"], svg[aria-label="Reply"], svg[aria-label="Balas"]'
                    ).first
                    await reply_btn.wait_for(state="visible", timeout=15000)
                    await reply_btn.click()
                    await asyncio.sleep(random.uniform(1.5, 2.8))

                    # Focus reply contenteditable composer
                    composer = page.locator(
                        'div[role="textbox"][contenteditable="true"], div[contenteditable="true"]'
                    ).last
                    await composer.wait_for(state="visible", timeout=15000)
                    await composer.click()
                    await asyncio.sleep(random.uniform(0.6, 1.2))

                    # Human-emulated typing (45-110ms per character)
                    await self._type_human_like(page, reply_text)
                    await asyncio.sleep(random.uniform(1.0, 2.0))

                    # Click Post / Kirim / Balas submit button inside dialog
                    submit_btn = page.locator(
                        'div[role="dialog"] div[role="button"]:has-text("Post"), '
                        'div[role="dialog"] div[role="button"]:has-text("Kirim"), '
                        'div[role="dialog"] button:has-text("Post"), '
                        'div[role="dialog"] button:has-text("Kirim"), '
                        'div[role="button"]:has-text("Post"), '
                        'div[role="button"]:has-text("Kirim")'
                    ).last

                    if await submit_btn.count() > 0:
                        await submit_btn.click()
                    else:
                        await page.keyboard.press("Control+Enter")

                    await asyncio.sleep(5.0)
                finally:
                    await context.close()
                    await browser.close()

            async with AsyncSessionLocal() as session:
                stmt = (
                    select(LeadPost)
                    .options(selectinload(LeadPost.matched_product))
                    .where(LeadPost.id == lead_id)
                )
                lead_db = (await session.execute(stmt)).scalar_one()
                bot_setting = await get_or_create_bot_settings(session)
                today_stat = await get_or_create_today_stat(session)

                lead_db.status = "COMMENTED"
                lead_db.commented_at = datetime.now(timezone.utc)
                lead_db.error_message = None
                today_stat.comments_sent += 1

                await session.commit()

                self.add_log(
                    "success",
                    f"Reply posted to @{lead_db.author_username} ({today_stat.comments_sent}/{bot_setting.max_comments_per_day} today).",
                )
                await notify_reply_sent(bot_setting, lead_db)
                return lead_db

        except Exception as exc:
            error_text = str(exc)
            async with AsyncSessionLocal() as session:
                lead_db = await session.get(LeadPost, lead_id)
                if lead_db is not None:
                    lead_db.status = "FAILED"
                    lead_db.error_message = error_text[:1000]
                    await session.commit()
            self.add_log("error", f"Failed sending reply to lead #{lead_id}: {error_text}")
            raise

    async def send_reply(self, lead_id: int) -> LeadPost:
        """Acquire scraper lock and send a human-emulated Threads reply."""
        async with self._lock:
            return await self._send_reply_unlocked(lead_id)


scraper_service = ThreadsScraperService()
