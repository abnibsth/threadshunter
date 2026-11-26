"""
Local Threads Session Helper (Windows / macOS / Linux).

Pilihan 1 (REKOMENDASI — Tanpa Buka Browser Baru!):
  Pakai sesi Threads yang SUDAH LOGIN di Google Chrome harianmu:
  1. Buka https://www.threads.com di Chrome lama kamu.
  2. Pasang ekstensi gratis "Cookie-Editor" dari Chrome Web Store.
  3. Klik Cookie-Editor -> klik "Export" -> pilih "Export as JSON" (otomatis ter-copy ke Clipboard!).
  4. Jalankan `python login_helper.py` -> tekan ENTER (Pilih 1) -> langsung jadi `auth_threads.json`!

Pilihan 2:
  Buka jendela Chrome khusus bot jika ingin login manual terpisah.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

BACKEND_DIR = Path(__file__).resolve().parent
OUTPUT_PATH = BACKEND_DIR / "data" / "auth_threads.json"
PERSISTENT_PROFILE_DIR = BACKEND_DIR / "data" / "chrome_profile"
LOGIN_COOKIE_NAMES = {"sessionid", "ds_user_id"}


def _is_threads_cookie(cookie: Dict[str, Any]) -> bool:
    domain = str(cookie.get("domain", "")).lower().strip()
    return "threads.net" in domain or "threads.com" in domain


def _analyze_cookies(cookies: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], bool]:
    threads_cookies = [c for c in cookies if _is_threads_cookie(c)]
    has_auth = any(
        str(c.get("name", "")).lower() in LOGIN_COOKIE_NAMES and bool(c.get("value"))
        for c in threads_cookies
    )
    return threads_cookies, has_auth


def _normalize_same_site(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if raw == "strict":
        return "Strict"
    if raw in {"none", "no_restriction"}:
        return "None"
    return "Lax"


def _save_from_json_string(raw_text: str) -> bool:
    try:
        parsed = json.loads(raw_text)
    except Exception as exc:
        print(f"\n[!] Isi Clipboard belum berupa JSON valid ({exc}).")
        return False

    if isinstance(parsed, list):
        raw_cookies = [c for c in parsed if isinstance(c, dict)]
        origins: List[Any] = []
    elif isinstance(parsed, dict) and isinstance(parsed.get("cookies"), list):
        raw_cookies = [c for c in parsed["cookies"] if isinstance(c, dict)]
        origins = parsed.get("origins", [])
    else:
        print("\n[!] Format JSON tidak dikenali. Pastikan klik Export -> Export as JSON di Cookie-Editor.")
        return False

    normalized: List[Dict[str, Any]] = []
    for raw in raw_cookies:
        name = str(raw.get("name", "")).strip()
        domain = str(raw.get("domain", "")).strip()
        if not name or not domain:
            continue
        same_site = _normalize_same_site(raw.get("sameSite"))
        secure = True if same_site == "None" else bool(raw.get("secure", True))
        exp = raw.get("expires", raw.get("expirationDate", -1))
        try:
            expires = float(exp) if exp is not None else -1.0
        except (TypeError, ValueError):
            expires = -1.0
        normalized.append(
            {
                "name": name,
                "value": str(raw.get("value", "")),
                "domain": domain,
                "path": str(raw.get("path") or "/"),
                "expires": expires,
                "httpOnly": bool(raw.get("httpOnly", False)),
                "secure": secure,
                "sameSite": same_site,
            }
        )

    threads_cookies, has_auth = _analyze_cookies(normalized)
    if not threads_cookies:
        print(
            "\n[!] Tidak ditemukan cookie threads.com / threads.net di Clipboard!\n"
            "    Pastikan kamu klik Cookie-Editor saat sedang berada di tab https://www.threads.com."
        )
        return False

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps({"cookies": normalized, "origins": origins}, indent=2),
        encoding="utf-8",
    )
    print(f"\n[SUKSES] Sesi Chrome lama kamu berhasil disalin ke: {OUTPUT_PATH}")
    print(f"         Total cookies              : {len(normalized)}")
    print(f"         Threads domain cookies     : {len(threads_cookies)}")
    print(f"         Login session terverifikasi: {'YA (Siap dipakai!)' if has_auth else 'BELUM LOGIN'}")
    return True


def _read_clipboard_text() -> str:
    # 1. Try tkinter (built into standard Python on Windows)
    try:
        import tkinter as tk

        root = tk.Tk()
        root.withdraw()
        text = root.clipboard_get()
        root.destroy()
        if text and text.strip():
            return text.strip()
    except Exception:
        pass

    # 2. Fallback to PowerShell Get-Clipboard on Windows
    try:
        res = subprocess.run(
            ["powershell", "-NoProfile", "-Command", "Get-Clipboard -Raw"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if res.returncode == 0 and res.stdout.strip():
            return res.stdout.strip()
    except Exception:
        pass

    return ""


def _run_clipboard_flow() -> None:
    print("\n" + "=" * 72)
    print(" MODE 1 — Pakai Sesi dari Chrome Lama Kamu (TANPA Buka Browser Baru)")
    print("=" * 72)
    print(" 1. Di Chrome hijau kamu yang biasa, buka tab: https://www.threads.com")
    print("    (Pastikan akun Threads kamu sudah dalam keadaan login di situ).")
    print(" 2. Pasang ekstensi Chrome gratis 'Cookie-Editor':")
    print("    https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm")
    print(" 3. Klik ikon Cookie-Editor di pojok kanan atas Chrome -> klik 'Export' -> 'JSON'.")
    print("    (Data sesi otomatis masuk ke Clipboard Windows kamu!)")
    print("=" * 72)

    while True:
        cmd = input(
            "\n>>> Sudah klik Export -> JSON di Chrome lama kamu? Tekan ENTER untuk ambil otomatis (atau ketik 'batal'): "
        ).strip().lower()
        if cmd in {"batal", "cancel", "q", "exit"}:
            print("Dibatalkan.")
            return

        clip = _read_clipboard_text()
        if not clip:
            print("[!] Clipboard kosong. Copy dulu dari Cookie-Editor -> Export -> JSON.")
            continue

        if _save_from_json_string(clip):
            return


async def _run_separate_browser_login() -> None:
    from playwright.async_api import async_playwright

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    PERSISTENT_PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        launch_kwargs: Dict[str, Any] = {
            "user_data_dir": str(PERSISTENT_PROFILE_DIR),
            "headless": False,
            "locale": "id-ID",
            "timezone_id": "Asia/Jakarta",
            "viewport": {"width": 1366, "height": 900},
            "args": ["--start-maximized"],
        }
        try:
            context = await p.chromium.launch_persistent_context(
                channel="chrome", **launch_kwargs
            )
        except Exception:
            context = await p.chromium.launch_persistent_context(**launch_kwargs)

        page = context.pages[0] if context.pages else await context.new_page()
        await page.goto("https://www.threads.com/", wait_until="domcontentloaded")

        while True:
            ans = await asyncio.to_thread(
                input,
                "\n>>> Sudah login di jendela baru? Ketik 'ok' + ENTER (atau 'batal'): ",
            )
            if ans.strip().lower() in {"batal", "q", "exit"}:
                await context.close()
                return
            if ans.strip().lower() != "ok":
                continue

            state = await context.storage_state()
            if _save_from_json_string(json.dumps(state)):
                break

        await context.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="ThreadsHunter Session Helper")
    parser.add_argument(
        "--import-cookies",
        type=str,
        default=None,
        help="Path ke file JSON hasil Export Cookie-Editor.",
    )
    args = parser.parse_args()

    if args.import_cookies:
        p = Path(args.import_cookies)
        if not p.exists():
            print(f"[ERROR] File tidak ditemukan: {p}")
            sys.exit(1)
        _save_from_json_string(p.read_text(encoding="utf-8"))
        return

    print("=" * 72)
    print(" ThreadsHunter — Hubungkan Akun Threads")
    print("=" * 72)
    print(" [1] Pakai sesi dari Chrome LAMA kamu yang sudah ada (TANPA buka browser baru!)")
    print(" [2] Buka browser baru terpisah untuk login manual")
    choice = input("\nPilih [1/2] (tekan ENTER untuk pilih 1): ").strip()

    if choice == "2":
        asyncio.run(_run_separate_browser_login())
    else:
        _run_clipboard_flow()


if __name__ == "__main__":
    main()
