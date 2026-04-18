#!/usr/bin/env python3
"""Speak arbitrary text with Samus mechanicus-voice (same pipeline as the Cursor hook).

Usage:
  pnpm run mechanicus:say -- Your line here.
  python scripts/mechanicus_say.py "Quoted phrase."
  python scripts/mechanicus_say.py                    # default sample line

Cursor hook (after each agent reply): controlled by .cursor/hooks.json — present = on.
Mute hook only (keep hooks.json): set env CURSOR_HOOK_MECHANICUS_LAST_SENTENCE=0 for Cursor.
Samus root: SAMUS_MANUS_ROOT (default C:\\dev\\samus-manus).
"""
from __future__ import annotations

import os
import subprocess
import sys


def main() -> int:
    text = " ".join(sys.argv[1:]).strip()
    if not text:
        text = "Flesh is weak. Steel and code endure."

    root = os.environ.get("SAMUS_MANUS_ROOT", r"C:\dev\samus-manus").strip()
    vp = os.path.join(root, "tools", "voice_profile.py")
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
