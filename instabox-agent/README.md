# InstaBox Telegram AI Vision Agent

Kendalikan layar Chromium di mesin InstaBox (`affiliate`) — yang sudah login **Threads** & **Shopee Affiliate** — langsung lewat chat **Telegram** hanya dengan mengetik prompt bahasa Indonesia.

## Cara Install di Terminal InstaBox (`>_`)

1. Klik ikon **Terminal (`>_`)** di dock bawah layar InstaBox kamu.
2. Clone repo kamu (atau `git pull` kalau sudah ada):
   ```bash
   git clone https://github.com/abnibsth/threadshunter.git
   cd threadshunter/instabox-agent
   bash setup_instabox.sh
   ```
3. Buat Bot Telegram di `@BotFather` (`/newbot`) untuk dapat `TELEGRAM_BOT_TOKEN`, lalu isi `.env`:
   ```bash
   nano .env
   ```
   Isi minimal:
   - `TELEGRAM_BOT_TOKEN=...`
   - `AI_API_KEY=...` (Gemini API key atau OpenRouter / 9Router key)
   - `AI_MODEL=gemini-2.5-flash`
4. Jalankan bot:
   ```bash
   source .venv/bin/activate
   python3 telegram_bot.py
   ```
5. Buka Telegram kamu -> kirim `/id` ke bot -> salin angka Chat ID kamu ke `TELEGRAM_ALLOWED_CHAT_ID` di `.env` (lalu restart bot) agar **hanya kamu** yang bisa menggerakkan InstaBox.

## Perintah Telegram
- `/screen` — Ambil screenshot live layar InstaBox sekarang.
- `/stop` — Hentikan agent seketika.
- **Kirim teks prompt bebas** — Contoh:
  > *"Di tab Shopee Affiliate, klik Buat Link pada Velixir Parfums Athena lalu salin linknya. Setelah itu pindah ke tab Threads, cari postingan terbaru tentang rekomendasi parfum awet, lalu balas 1 postingan yang paling cocok pakai bahasa santai Indonesia + link Shopee tadi."*

## Catatan Keamanan
- Agent selalu membaca link Shopee Affiliate asli dari clipboard (`read_clipboard`) setelah klik **Salin Link**, tidak pernah mengarang link palsu.
- Jika muncul CAPTCHA / verifikasi keamanan, agent otomatis berhenti dan mengirim screenshot ke Telegram supaya kamu klik **You're driving** di InstaBox secara manual.
