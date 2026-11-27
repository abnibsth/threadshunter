#!/usr/bin/env bash
set -e

echo "================================================================"
echo " InstaBox Telegram AI Vision Agent — Installer"
echo "================================================================"

echo "[1/3] Menginstal utilitas desktop X11 (xdotool, scrot, xclip)..."
if command -v sudo >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq xdotool scrot xclip python3-venv python3-pip
else
  apt-get update -qq
  apt-get install -y -qq xdotool scrot xclip python3-venv python3-pip
fi

echo "[2/3] Menyiapkan Python virtual environment..."
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q

echo "[3/3] Menyiapkan file .env..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  -> File .env dibuat dari .env.example."
fi

echo ""
echo "================================================================"
echo " SELESAI! Langkah berikutnya:"
echo " 1. Isi TELEGRAM_BOT_TOKEN dan AI_API_KEY di file .env:"
echo "      nano .env"
echo " 2. Jalankan bot agent:"
echo "      source .venv/bin/activate && python3 telegram_bot.py"
echo "================================================================"
