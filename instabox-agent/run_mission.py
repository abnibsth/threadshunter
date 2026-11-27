"""
One-shot CLI runner for Hermes Agent / MCP `instabox.exec`.

Usage inside InstaBox machine (`affiliate`):
    source .venv/bin/activate
    python3 run_mission.py "Buka tab Shopee Affiliate, klik Buat Link pada Velixir Parfums..."
"""

from __future__ import annotations

import asyncio
import json
import os
import sys

from dotenv import load_dotenv

from desktop_driver import InstaBoxDesktopDriver
from vision_agent import VisionComputerAgent

load_dotenv()


async def _main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python3 run_mission.py \"<prompt instruksi kamu>\"")
        sys.exit(1)

    prompt = " ".join(sys.argv[1:]).strip()
    api_key = (os.environ.get("AI_API_KEY") or "").strip()
    base_url = (
        os.environ.get("AI_BASE_URL")
        or "https://generativelanguage.googleapis.com/v1beta/openai/"
    ).strip()
    model = (os.environ.get("AI_MODEL") or "gemini-2.5-flash").strip()
    max_steps = int(os.environ.get("MAX_AGENT_STEPS") or "25")

    driver = InstaBoxDesktopDriver()
    agent = VisionComputerAgent(
        driver=driver,
        api_key=api_key,
        base_url=base_url,
        model=model,
        max_steps=max_steps,
    )

    stop_event = asyncio.Event()
    result = await agent.run(prompt, stop_event=stop_event)

    output = {
        "status": result.status,
        "steps_taken": result.steps_taken,
        "summary": result.summary,
        "captured_links": result.captured_links,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(_main())
