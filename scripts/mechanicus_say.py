#!/usr/bin/env python3
"""Speak arbitrary text with local/Samus mechanicus-voice helper.

Usage:
  pnpm run mechanicus:say -- Your line here.
  python scripts/mechanicus_say.py "Quoted phrase."
  python scripts/mechanicus_say.py                    # default sample line

Cursor hook (after each agent reply): controlled by .cursor/hooks.json — present = on.
Mute hook only (keep hooks.json): set env CURSOR_HOOK_MECHANICUS_LAST_SENTENCE=0 for Cursor.
Resolution order (for full FX like mechanicus/warp-spider):
  1) Samus helper: %SAMUS_MANUS_ROOT%/tools/voice_profile.py (default C:\\dev\\samus-manus)
  2) Local helper: <repo>/tools/voice_profile.py
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def resolve_voice_helper() -> tuple[str, str]:
    repo_root = Path(__file__).resolve().parents[1]
    samus_root = os.environ.get("SAMUS_MANUS_ROOT", r"C:\dev\samus-manus").strip()
    samus_helper = Path(samus_root) / "tools" / "voice_profile.py"
    if samus_helper.is_file():
        return samus_root, str(samus_helper)

    local_helper = repo_root / "tools" / "voice_profile.py"
    return str(repo_root), str(local_helper)


def main() -> int:
    text = " ".join(sys.argv[1:]).strip()
    if not text:
        text = "Flesh is weak. Steel and code endure."

    root, vp = resolve_voice_helper()
    if not os.path.isfile(vp):
        print(f"[mechanicus_say] missing {vp}", file=sys.stderr)
        return 1

    return subprocess.call(
        [sys.executable, vp, "speak", "mechanicus-voice", text],
        cwd=root,
        env=os.environ.copy(),
    )


if __name__ == "__main__":
    raise SystemExit(main())
