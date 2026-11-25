"""
Local Threads Session Login Helper (Windows / macOS / Linux).

Supports 3 ways to capture `backend/data/auth_threads.json`:
  1. Default (Google Chrome asli + profil khusus bot):
       python login_helper.py
     Opens your installed Google Chrome (falls back to Chromium) using a persistent
     profile in `backend/data/chrome_profile` so you only need to log in once.

  2. Use your existing Windows Google Chrome profile directly:
       python login_helper.py --use-my-chrome
     Lists your existing Chrome profiles (e.g. Andre Basit / Profile 1 / Default)
     so you can reuse an already-logged-in Threads session.
     (Close all Chrome windows first; note Chrome 136+ may restrict debugging the
      default User Data directory — if so, use Mode 3 below!)

  3. Import cookies directly from your already-open Chrome (Cookie-Editor JSON):
       python login_helper.py --import-cookies path/to/cookies.json
     Converts a Chrome Cookie-Editor JSON export from threads.com into Playwright's
     `backend/data/auth_threads.json` without logging in again.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from playwright.async_api import async_playwright

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


def _import_cookie_file(source_path: Path) -> None:
    if not source_path.exists():
        print(f"[ERROR] File tidak ditemukan: {source_path}")
        sys.exit(1)

    parsed = json.loads(source_path.read_text(encoding="utf-8"))
    if isinstance(parsed, list):
        raw_cookies = [c for c in parsed if isinstance(c, dict)]
        origins: List[Any] = []
    elif isinstance(parsed, dict) and isinstance(parsed.get("cookies"), list):
        raw_cookies = [c for c in parsed["cookies"] if isinstance(c, dict)]
        origins = parsed.get("origins", [])
    else:
        print("[ERROR] Format JSON tidak dikenali. Gunakan Export JSON dari Cookie-Editor.")
        sys.exit(1)

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
        print("[ERROR] Tidak ada cookie domain threads.com / threads.net di file ini.")
        sys.exit(1)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps({"cookies": normalized, "origins": origins}, indent=2),
        encoding="utf-8",
    )
    print(f"[OK] Berhasil import & konversi ke: {OUTPUT_PATH}")
    print(f"     Total cookies              : {len(normalized)}")
    print(f"     Threads domain cookies     : {len(threads_cookies)}")
    print(f"     Login session terverifikasi: {'YA' if has_auth else 'BELUM'}")


def _discover_windows_chrome_profiles() -> Tuple[Optional[Path], List[Tuple[str, str]]]:
    local_app_data = os.environ.get("LOCALAPPDATA")
    if not local_app_data:
        return None, []
    user_data_dir = Path(local_app_data) / "Google" / "Chrome" / "User Data"
    if not user_data_dir.exists():
        return None, []

    profiles: List[Tuple[str, str]] = []
    local_state_file = user_data_dir / "Local State"
    if local_state_file.exists():
        try:
            state = json.loads(local_state_file.read_text(encoding="utf-8"))
            info_cache = state.get("profile", {}).get("info_cache", {})
            for folder_name, meta in info_cache.items():
                display_name = meta.get("name") or folder_name
                email = meta.get("user_name") or ""
                label = f"{display_name} ({email})" if email else display_name
                profiles.append((folder_name, label))
        except Exception:
            pass

    if not profiles:
        for child in sorted(user_data_dir.iterdir()):
            if child.is_dir() and (
                child.name == "Default" or child.name.startswith("Profile ")
            ):
                profiles.append((child.name, child.name))

    return user_data_dir, profiles


async def _run_interactive_login(use_my_chrome: bool, profile_arg: Optional[str]) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    user_data_dir = PERSISTENT_PROFILE_DIR
    extra_args = [
        "--disable-blink-features=AutomationControlled",
        "--start-maximized",
    ]

    if use_my_chrome:
        chrome_dir, profiles = _discover_windows_chrome_profiles()
        if chrome_dir is None:
            print("[ERROR] Folder profil Google Chrome Windows tidak ditemukan.")
            sys.exit(1)

        chosen_profile = profile_arg
        if not chosen_profile:
            print("\nProfil Google Chrome yang terdeteksi di PC kamu:")
            for idx, (folder, label) in enumerate(profiles, start=1):
                print(f"  {idx}. {label}  [{folder}]")
            raw_choice = input("\nPilih nomor profil (misal 1): ").strip()
            try:
                chosen_profile = profiles[int(raw_choice) - 1][0]
            except Exception:
                print("[ERROR] Pilihan tidak valid.")
                sys.exit(1)

        user_data_dir = chrome_dir
        extra_args.append(f"--profile-directory={chosen_profile}")
        print("\n[PENTING] Tutup SEMUA jendela Google Chrome yang sedang terbuka terlebih dahulu!")
        input(">>> Sudah tutup semua jendela Chrome? Tekan ENTER untuk lanjut... ")
    else:
        PERSISTENT_PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 72)
    print(" Threads Affiliate AI Hunter — Google Chrome Login Helper")
    print("=" * 72)
    print(f" Mode       : {'Profil Chrome Kamu' if use_my_chrome else 'Google Chrome (Profil Khusus Bot)'}")
    print(f" User Data  : {user_data_dir}")
    print(" 1. Jendela Google Chrome akan terbuka ke https://www.threads.com/login.")
    print(" 2. Jika belum login, login dulu (atau langsung masuk kalau sudah login).")
    print(" 3. Setelah feed Threads tampil penuh, kembali ke sini, ketik 'ok' + ENTER.")
    print("=" * 72)

    async with async_playwright() as p:
        launch_kwargs: Dict[str, Any] = {
            "user_data_dir": str(user_data_dir),
            "headless": False,
            "locale": "id-ID",
            "timezone_id": "Asia/Jakarta",
            "viewport": {"width": 1366, "height": 900},
            "args": extra_args,
        }

        try:
            # Prefer real installed Google Chrome instead of bare Playwright Chromium
            context = await p.chromium.launch_persistent_context(
                channel="chrome", **launch_kwargs
            )
        except Exception as chrome_exc:
            if use_my_chrome:
                print(f"\n[!] Google Chrome menolak akses ke profil default: {chrome_exc}")
                print(
                    "\nTips (Chrome versi 136+ memblokir remote debugging di folder User Data default):\n"
                    "  CARA TERCEPAT tanpa login ulang:\n"
                    "  1. Buka https://www.threads.com di Chrome kamu yang biasa (pastikan sudah login).\n"
                    "  2. Pasang ekstensi 'Cookie-Editor' di Chrome Web Store.\n"
                    "  3. Klik ikon Cookie-Editor di tab threads.com -> Export -> Export as JSON.\n"
                    "  4. Simpan file sebagai cookies.json lalu upload langsung di halaman Settings\n"
                    "     (atau jalankan: python login_helper.py --import-cookies cookies.json).\n"
                    "\n  ATAU jalankan `python login_helper.py` (tanpa --use-my-chrome) untuk\n"
                    "  login 1x saja di Google Chrome profil khusus bot."
                )
                return
            print(f"[Info] Google Chrome tidak terdeteksi ({chrome_exc}), fallback ke Chromium...")
            context = await p.chromium.launch_persistent_context(**launch_kwargs)

        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
        )

        page = context.pages[0] if context.pages else await context.new_page()
        print("\n[...] Membuka https://www.threads.com/ ...")
        await page.goto("https://www.threads.com/", wait_until="domcontentloaded")
        print("[OK] Jendela Chrome sudah terbuka.")

        while True:
            answer = await asyncio.to_thread(
                input,
                "\n>>> Sudah masuk ke feed Threads? Ketik 'ok' lalu ENTER (atau 'batal'): ",
            )
            cleaned = answer.strip().lower()
            if cleaned in {"batal", "cancel", "q", "exit"}:
                print("Dibatalkan.")
                await context.close()
                return

            if cleaned not in {"ok", "ya", "yes", "done", "save"}:
                print("    [Info] Ketik 'ok' + ENTER kalau sudah melihat feed Threads kamu.")
                continue

            state = await context.storage_state()
            cookies = state.get("cookies", [])
            threads_cookies, has_auth = _analyze_cookies(cookies)

            if not has_auth:
                print(
                    f"\n[!] Cookie login (sessionid/ds_user_id) BELUM terdeteksi "
                    f"(baru ada {len(threads_cookies)} cookie tamu)."
                )
                force = await asyncio.to_thread(
                    input,
                    "    Ketik 'paksa' untuk tetap simpan, atau tekan ENTER untuk lanjut login dulu: ",
                )
                if force.strip().lower() != "paksa":
                    continue

            OUTPUT_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")
            print(f"\n[OK] Session berhasil disimpan ke: {OUTPUT_PATH}")
            print(f"     Total cookies captured     : {len(cookies)}")
            print(f"     Threads domain cookies     : {len(threads_cookies)}")
            print(f"     Login session terverifikasi: {'YA' if has_auth else 'BELUM'}")
            break

        await context.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Threads Affiliate AI Hunter — Local Chrome Login Helper"
    )
    parser.add_argument(
        "--use-my-chrome",
        action="store_true",
        help="Gunakan profil Google Chrome Windows kamu yang sudah ada (tutup Chrome dulu).",
    )
    parser.add_argument(
        "--profile",
        type=str,
        default=None,
        help="Nama folder profil Chrome (misal 'Default', 'Profile 1') untuk --use-my-chrome.",
    )
    parser.add_argument(
        "--import-cookies",
        type=str,
        default=None,
        help="Import file JSON hasil Export dari ekstensi Chrome Cookie-Editor di threads.com.",
    )
    args = parser.parse_args()

    if args.import_cookies:
        _import_cookie_file(Path(args.import_cookies))
        return

    asyncio.run(_run_interactive_login(args.use_my_chrome, args.profile))


if __name__ == "__main__":
    main()
