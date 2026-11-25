from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.models import BotSetting, LeadPost

logger = logging.getLogger(__name__)


async def send_telegram_message(
    bot_token: Optional[str],
    chat_id: Optional[str],
    text: str,
) -> bool:
    """Send an optional Markdown/HTML notification via Telegram Bot API."""
    if not bot_token or not chat_id:
        return False

    url = f"https://api.telegram.org/bot{bot_token.strip()}/sendMessage"
    payload = {
        "chat_id": chat_id.strip(),
        "text": text,
        "disable_web_page_preview": True,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                logger.warning("Telegram API returned %s: %s", resp.status_code, resp.text[:200])
                return False
            return True
    except Exception as exc:
        logger.warning("Telegram notification failed: %s", exc)
        return False


async def notify_new_lead(setting: BotSetting, lead: LeadPost, product_name: Optional[str] = None) -> bool:
    """Notify operator on Telegram when a high-intent lead is captured."""
    if not setting.telegram_bot_token or not setting.telegram_chat_id:
        return False

    excerpt = lead.post_text[:220] + ("..." if len(lead.post_text) > 220 else "")
    product_label = product_name or "Unmatched"
    msg = (
        f"🔥 High-Intent Lead ({lead.intent_score}%)\n"
        f"Author: @{lead.author_username}\n"
        f"Keyword: {lead.keyword_matched}\n"
        f"Product: {product_label}\n"
        f"Status: {lead.status}\n\n"
        f"Post:\n\"{excerpt}\"\n\n"
        f"Draft Reply:\n{lead.draft_reply}\n\n"
        f"Link: {lead.post_url}"
    )
    return await send_telegram_message(setting.telegram_bot_token, setting.telegram_chat_id, msg)


async def notify_reply_sent(setting: BotSetting, lead: LeadPost) -> bool:
    """Notify operator on Telegram when an affiliate reply is posted."""
    if not setting.telegram_bot_token or not setting.telegram_chat_id:
        return False

    msg = (
        f"✅ Affiliate Reply Sent\n"
        f"Target: @{lead.author_username} ({lead.intent_score}% intent)\n"
        f"Reply: {lead.draft_reply}\n"
        f"Post: {lead.post_url}"
    )
    return await send_telegram_message(setting.telegram_bot_token, setting.telegram_chat_id, msg)
