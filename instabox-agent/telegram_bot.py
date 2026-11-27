"""
Telegram Controller for InstaBox AI Vision Agent.

Run inside your InstaBox Linux machine (`affiliate`):
    source .venv/bin/activate
    python3 telegram_bot.py

Then simply chat your bot on Telegram from your phone or browser!
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from typing import Optional

import httpx
from dotenv import load_dotenv

from desktop_driver import InstaBoxDesktopDriver
from vision_agent import VisionComputerAgent

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
)
logger = logging.getLogger("instabox-telegram")

TELEGRAM_BOT_TOKEN = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
ALLOWED_CHAT_ID = (os.environ.get("TELEGRAM_ALLOWED_CHAT_ID") or "").strip()
AI_BASE_URL = (
    os.environ.get("AI_BASE_URL")
    or "https://generativelanguage.googleapis.com/v1beta/openai/"
).strip()
AI_API_KEY = (os.environ.get("AI_API_KEY") or "").strip()
AI_MODEL = (os.environ.get("AI_MODEL") or "gemini-2.5-flash").strip()
MAX_STEPS = int(os.environ.get("MAX_AGENT_STEPS") or "25")

TG_API_BASE = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"


class TelegramClient:
    def __init__(self) -> None:
        self._http = httpx.AsyncClient(timeout=45.0)

    async def close(self) -> None:
        await self._http.aclose()

    async def get_updates(self, offset: int) -> list[dict]:
        resp = await self._http.get(
            f"{TG_API_BASE}/getUpdates",
            params={"offset": offset, "timeout": 25},
        )
        data = resp.json()
        if not data.get("ok"):
            raise RuntimeError(f"Telegram getUpdates error: {data}")
        return data.get("result", [])

    async def send_text(self, chat_id: int | str, text: str) -> None:
        await self._http.post(
            f"{TG_API_BASE}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": text[:4000],
                "disable_web_page_preview": True,
            },
        )

    async def send_photo(self, chat_id: int | str, jpeg_bytes: bytes, caption: str = "") -> None:
        files = {"photo": ("screen.jpg", jpeg_bytes, "image/jpeg")}
        data = {"chat_id": str(chat_id), "caption": caption[:1000]}
        await self._http.post(f"{TG_API_BASE}/sendPhoto", data=data, files=files)


async def main() -> None:
    if not TELEGRAM_BOT_TOKEN:
        print("[ERROR] TELEGRAM_BOT_TOKEN belum diisi di file .env!")
        sys.exit(1)

    driver = InstaBoxDesktopDriver()
    agent = VisionComputerAgent(
        driver=driver,
        api_key=AI_API_KEY,
        base_url=AI_BASE_URL,
        model=AI_MODEL,
        max_steps=MAX_STEPS,
    )
    tg = TelegramClient()

    current_task: Optional[asyncio.Task] = None
    stop_event = asyncio.Event()
    offset = 0

    logger.info(
        "InstaBox Telegram Agent aktif! DISPLAY=%s | Model=%s | AllowedChat=%s",
        driver.display,
        AI_MODEL,
        ALLOWED_CHAT_ID or "SEMUA (segera isi TELEGRAM_ALLOWED_CHAT_ID di .env!)",
    )

    async def run_mission(chat_id: int, prompt: str) -> None:
        stop_event.clear()
        await tg.send_text(
            chat_id,
            f"Siap, mulai menjalankan misi di InstaBox ({AI_MODEL}):\n\"{prompt}\"\n\nKirim /stop kapan saja untuk berhenti.",
        )

        async def _progress(msg: str, photo: Optional[bytes]) -> None:
            if photo:
                await tg.send_photo(chat_id, photo, caption=msg)
            else:
                await tg.send_text(chat_id, msg)

        result = await agent.run(prompt, stop_event=stop_event, on_progress=_progress)

        header = {
            "done": "Selesai!",
            "need_human": "Butuh bantuan manual di InstaBox (klik You're driving):",
            "stopped": "Dihentikan.",
            "max_steps": "Mencapai batas langkah:",
            "error": "Kendala:",
        }.get(result.status, "Status:")

        links_text = ""
        if result.captured_links:
            links_text = "\n\nLink Shopee Affiliate tersalin:\n" + "\n".join(
                f"- {lnk}" for lnk in result.captured_links
            )

        caption = f"{header}\n{result.summary}\n(Total {result.steps_taken} langkah){links_text}"
        if result.last_screenshot:
            await tg.send_photo(chat_id, result.last_screenshot, caption=caption)
        else:
            await tg.send_text(chat_id, caption)

    try:
        while True:
            try:
                updates = await tg.get_updates(offset)
            except Exception as poll_exc:
                logger.warning("Polling error: %s", poll_exc)
                await asyncio.sleep(3)
                continue

            for upd in updates:
                offset = upd["update_id"] + 1
                msg = upd.get("message") or {}
                text = (msg.get("text") or "").strip()
                chat_id = msg.get("chat", {}).get("id")
                if not chat_id or not text:
                    continue

                if text == "/id":
                    await tg.send_text(
                        chat_id,
                        f"Chat ID kamu: {chat_id}\nMasukkan angka ini ke TELEGRAM_ALLOWED_CHAT_ID di file .env agar bot terkunci khusus milikmu.",
                    )
                    continue

                if ALLOWED_CHAT_ID and str(chat_id) != ALLOWED_CHAT_ID:
                    logger.warning("Mengabaikan pesan dari chat_id tidak dikenal: %s", chat_id)
                    continue

                if text in {"/start", "/help"}:
                    await tg.send_text(
                        chat_id,
                        "InstaBox Affiliate Agent siap!\n\n"
                        "Perintah:\n"
                        "• Kirim prompt bebas -> AI langsung gerak di Chromium InstaBox\n"
                        "• /screen -> Lihat screenshot layar InstaBox sekarang\n"
                        "• /stop -> Hentikan misi yang sedang berjalan\n"
                        "• /id -> Lihat Chat ID kamu\n\n"
                        "Contoh prompt:\n"
                        "\"Di tab Shopee Affiliate, cari 1 produk parfum Komisi XTRA lalu klik Buat Link dan salin linknya. "
                        "Setelah itu pindah ke tab Threads, cari yang tanya rekomendasi parfum, lalu balas 1 postingan pakai bahasa santai + link Shopee tadi.\"",
                    )
                    continue

                if text == "/screen":
                    try:
                        cap = await asyncio.to_thread(driver.screenshot)
                        await tg.send_photo(
                            chat_id,
                            cap.jpeg_bytes,
                            caption=f"Layar InstaBox saat ini ({cap.width}x{cap.height}, DISPLAY={driver.display})",
                        )
                    except Exception as exc:
                        await tg.send_text(chat_id, f"Gagal ambil screenshot: {exc}")
                    continue

                if text == "/stop":
                    if current_task and not current_task.done():
                        stop_event.set()
                        await tg.send_text(chat_id, "Mengirim sinyal berhenti ke agent...")
                    else:
                        await tg.send_text(chat_id, "Tidak ada misi yang sedang berjalan.")
                    continue

                if not AI_API_KEY and "localhost" not in AI_BASE_URL.lower():
                    await tg.send_text(
                        chat_id,
                        "AI_API_KEY belum diisi di file .env mesin InstaBox. Isi dulu lalu restart bot.",
                    )
                    continue

                if current_task and not current_task.done():
                    await tg.send_text(
                        chat_id,
                        "Agent masih menjalankan misi sebelumnya. Tunggu selesai atau kirim /stop dulu.",
                    )
                    continue

                current_task = asyncio.create_task(run_mission(chat_id, text))

    finally:
        await tg.close()


if __name__ == "__main__":
    asyncio.run(main())
