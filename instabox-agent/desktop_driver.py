from __future__ import annotations

import base64
import glob
import io
import os
import random
import subprocess
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from PIL import Image


@dataclass
class ScreenCapture:
    width: int
    height: int
    jpeg_bytes: bytes
    base64_jpeg: str


def detect_x11_display() -> str:
    """Auto-detect the active X11 DISPLAY running the InstaBox Chromium desktop."""
    configured = (os.environ.get("DISPLAY") or "").strip()
    if configured:
        return configured

    # 1. Inspect running Chromium / Chrome process environment if available
    try:
        for env_path in glob.glob("/proc/[0-9]*/environ"):
            try:
                cmd_path = env_path.replace("/environ", "/cmdline")
                cmdline = Path(cmd_path).read_text(errors="ignore").lower()
                if "chrom" not in cmdline and "xfce" not in cmdline and "openbox" not in cmdline:
                    continue
                raw_env = Path(env_path).read_bytes().split(b"\x00")
                for entry in raw_env:
                    if entry.startswith(b"DISPLAY="):
                        val = entry.split(b"=", 1)[1].decode("utf-8", errors="ignore").strip()
                        if val:
                            return val
            except Exception:
                continue
    except Exception:
        pass

    # 2. Check /tmp/.X11-unix/X* sockets
    sockets = sorted(glob.glob("/tmp/.X11-unix/X*"))
    if sockets:
        display_num = Path(sockets[0]).name.lstrip("X")
        if display_num.isdigit():
            return f":{display_num}"

    return ":0"


class InstaBoxDesktopDriver:
    """Controls the live Linux X11 desktop inside InstaBox via scrot, xdotool, and xclip."""

    def __init__(self, display: Optional[str] = None) -> None:
        self.display = display or detect_x11_display()
        self._env = {**os.environ, "DISPLAY": self.display}

    def _run(self, args: list[str], input_bytes: Optional[bytes] = None, timeout: int = 15) -> subprocess.CompletedProcess:
        return subprocess.run(
            args,
            env=self._env,
            input=input_bytes,
            capture_output=True,
            timeout=timeout,
            check=False,
        )

    def screenshot(self, max_width: int = 1280, quality: int = 80) -> ScreenCapture:
        """Capture the full live X11 screen and return both real dimensions and resized JPEG."""
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            res = self._run(["scrot", "-o", tmp_path])
            if res.returncode != 0 or not Path(tmp_path).exists():
                stderr = res.stderr.decode("utf-8", errors="ignore").strip()
                raise RuntimeError(
                    f"Gagal mengambil screenshot pada DISPLAY={self.display}: {stderr or 'scrot error'}"
                )

            with Image.open(tmp_path) as img:
                orig_w, orig_h = img.size
                rgb = img.convert("RGB")
                if orig_w > max_width:
                    ratio = max_width / float(orig_w)
                    rgb = rgb.resize((max_width, int(orig_h * ratio)), Image.Resampling.LANCZOS)

                buf = io.BytesIO()
                rgb.save(buf, format="JPEG", quality=quality, optimize=True)
                jpeg_bytes = buf.getvalue()

            return ScreenCapture(
                width=orig_w,
                height=orig_h,
                jpeg_bytes=jpeg_bytes,
                base64_jpeg=base64.b64encode(jpeg_bytes).decode("ascii"),
            )
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    def _to_real_xy(self, norm_x: float, norm_y: float, screen_w: int, screen_h: int) -> tuple[int, int]:
        clamped_x = max(0.0, min(1000.0, float(norm_x)))
        clamped_y = max(0.0, min(1000.0, float(norm_y)))
        real_x = int(round((clamped_x / 1000.0) * screen_w))
        real_y = int(round((clamped_y / 1000.0) * screen_h))
        return real_x, real_y

    def click(self, norm_x: float, norm_y: float, screen_w: int, screen_h: int, double: bool = False) -> str:
        rx, ry = self._to_real_xy(norm_x, norm_y, screen_w, screen_h)
        self._run(["xdotool", "mousemove", "--sync", str(rx), str(ry)])
        time.sleep(random.uniform(0.12, 0.28))
        if double:
            self._run(["xdotool", "click", "--repeat", "2", "--delay", "90", "1"])
            return f"double_click({rx}, {ry})"
        self._run(["xdotool", "click", "1"])
        return f"click({rx}, {ry})"

    def move(self, norm_x: float, norm_y: float, screen_w: int, screen_h: int) -> str:
        rx, ry = self._to_real_xy(norm_x, norm_y, screen_w, screen_h)
        self._run(["xdotool", "mousemove", "--sync", str(rx), str(ry)])
        return f"move({rx}, {ry})"

    def type_text(self, text: str, human_pace: bool = True) -> str:
        """Type text naturally; falls back to xclip paste for non-ASCII/emoji characters."""
        clean = text or ""
        if not clean:
            return "type_text(empty)"

        is_pure_ascii = all(32 <= ord(ch) <= 126 or ch == "\n" for ch in clean)
        if is_pure_ascii and human_pace and len(clean) <= 320:
            for ch in clean:
                if ch == "\n":
                    self._run(["xdotool", "key", "Shift+Return"])
                else:
                    delay_ms = random.randint(45, 95)
                    self._run(["xdotool", "type", "--delay", str(delay_ms), "--", ch])
            return f"typed {len(clean)} chars"

        # Clipboard paste fallback for Indonesian emojis / long strings
        self._run(["xclip", "-selection", "clipboard"], input_bytes=clean.encode("utf-8"))
        time.sleep(0.15)
        self._run(["xdotool", "key", "ctrl+v"])
        return f"pasted {len(clean)} chars"

    def press_key(self, key_combo: str) -> str:
        key_map = {
            "enter": "Return",
            "return": "Return",
            "esc": "Escape",
            "escape": "Escape",
            "tab": "Tab",
            "backspace": "BackSpace",
            "delete": "Delete",
            "space": "space",
            "up": "Up",
            "down": "Down",
            "left": "Left",
            "right": "Right",
            "pagedown": "Page_Down",
            "pageup": "Page_Up",
        }
        raw = (key_combo or "").strip()
        parts = [key_map.get(p.strip().lower(), p.strip()) for p in raw.split("+") if p.strip()]
        normalized = "+".join(parts) or "Return"
        self._run(["xdotool", "key", "--clearmodifiers", normalized])
        return f"key({normalized})"

    def scroll(self, direction: str = "down", steps: int = 5) -> str:
        btn = "5" if direction.lower() != "up" else "4"
        safe_steps = max(1, min(15, int(steps)))
        for _ in range(safe_steps):
            self._run(["xdotool", "click", btn])
            time.sleep(random.uniform(0.06, 0.14))
        return f"scroll({direction}, {safe_steps})"

    def read_clipboard(self) -> str:
        """Read current X11 clipboard text (ideal right after clicking 'Salin Link' in Shopee Affiliate)."""
        res = self._run(["xclip", "-o", "-selection", "clipboard"])
        if res.returncode != 0:
            return ""
        return res.stdout.decode("utf-8", errors="ignore").strip()
