#!/usr/bin/env python3
"""
Project hook (weyland-yutani-cyberdeck): afterAgentResponse -> mechanicus TTS last sentence.

Cursor: .cursor/hooks.json should call `python -u .cursor/hooks/speak_last_sentence_mechanicus.py`
(direct Python stdin; the .cmd launcher is only for manual runs — cmd `&&` chains can eat stdin).
Logs (gitignored): mechanicus-hook.log (flow + snippet + pid); mechanicus-tts-stderr.log (Samus/pygame).
Voice profile for speak: `.cursor/hooks/cursor-tts-voice.txt` (one line: slug id, e.g. mechanicus-voice); Cyberdeck dev bridge writes this file.
Optional gain: `.cursor/hooks/cursor-tts-volume.txt` (integer 0–100, 100 = profile default; Cyberdeck Cursor card knob).
If the hook log looks stale in the editor, reopen the file or run tail — Cursor often does not auto-refresh ignored logs.
Smoke (real TTS): pnpm run hook:smoke-mechanicus-voice
Debug stdin: set CURSOR_HOOK_MECHANICUS_DEBUG=1 for Cursor, then retry once.

Disable: CURSOR_HOOK_MECHANICUS_LAST_SENTENCE=0
Cyberdeck (pnpm dev): write `.cursor/hooks/mechanicus-cursor.muted` containing `1` to mute; delete file or `0` to unmute (UI uses dev bridge GET/POST /__cyberdeck/mechanicus-cursor).
Legacy win32 spawn (full detach; can break default audio on some PCs): CURSOR_HOOK_MECHANICUS_DETACHED=1
Voice helper resolution:
  1) local helper at <repo>/tools/voice_profile.py
  2) %SAMUS_MANUS_ROOT%/tools/voice_profile.py (default C:\\dev\\samus-manus)

Test without Cursor (type exactly this; do not add anything after the script name):
  pnpm run hook:test-mechanicus-last
  pnpm run hook:dry-mechanicus-last
  Custom JSON: echo '{"text":"Your."}' | python .cursor/hooks/speak_last_sentence_mechanicus.py --dry-run --stdin
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

_HOOK_DIR = Path(__file__).resolve().parent
_LOG_PATH = _HOOK_DIR / "mechanicus-hook.log"
_TTS_STDERR_PATH = _HOOK_DIR / "mechanicus-tts-stderr.log"
_CYBERDECK_MUTE_PATH = _HOOK_DIR / "mechanicus-cursor.muted"
_CURSOR_VOICE_PATH = _HOOK_DIR / "cursor-tts-voice.txt"
_CURSOR_VOLUME_PATH = _HOOK_DIR / "cursor-tts-volume.txt"
_CURSOR_VOICE_ID_RE = re.compile(r"^[a-z][a-z0-9-]{0,62}$")


# Cursor dial → Samus trim. Keep in sync with `src/lib/cursorTtsVolume.ts`.
_VOL_UI_MIN = 0
_VOL_UI_MAX = 100
_VOL_UI_DEFAULT = 100
_VOL_NO_OVERRIDE_MIN = 99  # UI at or above: no --volume
_VOL_TRIM_PCT_MIN = -40
_VOL_TRIM_PCT_MAX = 0
_VOL_UI_TO_TRIM_SCALE = 0.5


def _resolve_voice_profile_helper() -> tuple[str, str]:
    """Return (cwd_root, voice_profile.py path), preferring Samus for full FX chains."""
    repo_root = _HOOK_DIR.parents[1]
    samus_root = os.environ.get("SAMUS_MANUS_ROOT", r"C:\dev\samus-manus").strip()
    samus_helper = Path(samus_root) / "tools" / "voice_profile.py"
    if samus_helper.is_file():
        return samus_root, str(samus_helper)

    local = repo_root / "tools" / "voice_profile.py"
    return str(repo_root), str(local)


def _read_cursor_tts_volume_override() -> str | None:
    """Map `.cursor/hooks/cursor-tts-volume.txt` (0–100) to Samus `BOOTUP_TTS_VOLUME` trim; stay in safe % range."""
    try:
        if not _CURSOR_VOLUME_PATH.is_file():
            return None
        raw = _CURSOR_VOLUME_PATH.read_text(encoding="utf-8").strip()
        n = int(raw)
    except (OSError, ValueError):
        return None
    n = max(_VOL_UI_MIN, min(_VOL_UI_MAX, n))
    if n >= _VOL_NO_OVERRIDE_MIN:
        return None
    raw_delta = (n - _VOL_UI_DEFAULT) * _VOL_UI_TO_TRIM_SCALE
    delta = int(round(max(_VOL_TRIM_PCT_MIN, min(_VOL_TRIM_PCT_MAX, raw_delta))))
    if delta >= 0:
        return None
    return f"{delta:+d}%"


def _read_cursor_hook_voice_profile() -> str:
    """Samus voice_profile speak id; file written by Cyberdeck UI or by hand."""
    default = "mechanicus-voice"
    try:
        if not _CURSOR_VOICE_PATH.is_file():
            return default
        raw = _CURSOR_VOICE_PATH.read_text(encoding="utf-8").strip()
    except OSError:
        return default
    if _CURSOR_VOICE_ID_RE.fullmatch(raw):
        return raw
    return default


def _cyberdeck_mutes_cursor_hook() -> bool:
    """True if Cyberdeck UI or user created `.cursor/hooks/mechanicus-cursor.muted` with `1`."""
    try:
        if not _CYBERDECK_MUTE_PATH.is_file():
            return False
        s = _CYBERDECK_MUTE_PATH.read_text(encoding="utf-8").strip()
    except OSError:
        return False
    return s == "1"


def _log(msg: str) -> None:
    line = f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {msg}\n"
    try:
        with open(_LOG_PATH, "a", encoding="utf-8") as fh:
            fh.write(line)
            fh.flush()
    except OSError as e:
        try:
            print(f"[mechanicus-hook] log write failed: {e}", file=sys.stderr)
            print(f"[mechanicus-hook] {line.rstrip()}", file=sys.stderr)
        except OSError:
            pass


def _strip_markdownish(text: str) -> str:
    t = re.sub(r"```[\s\S]*?```", " ", text)
    t = re.sub(r"`+([^`]+)`+", r"\1", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    t = re.sub(r"[#>*_]+", " ", t)
    return " ".join(t.split())


def _read_stdin_text() -> str:
    """Read hook JSON from stdin; utf-8-sig strips BOM; binary-safe."""
    raw = sys.stdin.buffer.read()
    if not raw:
        return ""
    return raw.decode("utf-8-sig", errors="replace")


def _parse_json_object(raw: str) -> dict | None:
    """Parse one JSON object; tolerate leading/trailing noise or NDJSON first line."""
    s = (raw or "").strip()
    if not s:
        return None
    try:
        out = json.loads(s)
        return out if isinstance(out, dict) else None
    except json.JSONDecodeError:
        pass
    for line in s.splitlines():
        line = line.strip()
        if not line or not line.startswith("{"):
            continue
        try:
            out = json.loads(line)
            if isinstance(out, dict):
                return out
        except json.JSONDecodeError:
            continue
    start = s.find("{")
    end = s.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            out = json.loads(s[start : end + 1])
            return out if isinstance(out, dict) else None
        except json.JSONDecodeError:
            pass
    return None


def _extract_full_text(data: dict) -> str:
    """Collect assistant text from Cursor / variant hook payloads."""
    # Prefer assistant-specific keys before generic "text".
    for key in ("assistantMessage", "assistant_message", "output", "response", "message", "text"):
        v = data.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    messages = data.get("messages")
    if isinstance(messages, list):
        for item in reversed(messages):
            if not isinstance(item, dict):
                continue
            role = str(item.get("role", "")).lower()
            if role not in ("assistant", "model", "ai"):
                continue
            for key in ("content", "text", "message"):
                val = item.get(key)
                if isinstance(val, str) and val.strip():
                    return val.strip()
    msg = data.get("message")
    if isinstance(msg, dict):
        inner = _extract_full_text(msg)
        if inner:
            return inner
    parts = data.get("parts")
    if isinstance(parts, list):
        chunks: list[str] = []
        for p in parts:
            if isinstance(p, str) and p.strip():
                chunks.append(p.strip())
            elif isinstance(p, dict):
                t = p.get("text")
                if isinstance(t, str) and t.strip():
                    chunks.append(t.strip())
        if chunks:
            return "\n".join(chunks)
    return ""


def last_sentence(text: str) -> str:
    if not text or not text.strip():
        return ""
    t = _strip_markdownish(text).strip()
    if not t:
        return ""
    # Prefer the last non-empty line first (helps when payload includes sections).
    lines = [ln.strip() for ln in t.splitlines() if ln.strip()]
    if lines:
        t = lines[-1]
    parts = re.split(r"(?<=[.!?])\s+", t)
    parts = [p.strip() for p in parts if p.strip()]
    if not parts:
        return t[:500]
    out = parts[-1]
    return out[:500] if len(out) > 500 else out


def self_test() -> int:
    cases = [
        ("First. Last wins.", "Last wins."),
        ("One sentence only.", "One sentence only."),
        ("Hello. World", "World"),
        ("", ""),
        ("```js\nx\n```\nDone.", "Done."),
    ]
    failed = 0
    for raw, want in cases:
        got = last_sentence(raw)
        if got != want:
            print(f"FAIL last_sentence({raw!r}) -> {got!r} want {want!r}", file=sys.stderr)
            failed += 1
        else:
            print(f"ok {want!r}")
    if failed:
        print(f"{failed} case(s) failed", file=sys.stderr)
        return 1
    print("[self-test] all cases passed")
    return 0


def dry_run() -> int:
    """Print last sentence + samus path check. Does not read stdin unless --stdin (avoids pnpm hang)."""
    default = '{"text":"First idea. Second idea. Last sentence wins."}'
    if "--stdin" in sys.argv:
        raw = sys.stdin.read()
        if not raw.strip():
            raw = default
    else:
        raw = default
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[dry-run] invalid JSON: {e}", file=sys.stderr)
        return 1
    full = (data.get("text") or "").strip()
    snippet = last_sentence(full)
    print(f"[dry-run] last_sentence = {snippet!r}")
    root, vp = _resolve_voice_profile_helper()
    print(f"[dry-run] voice_profile exists: {os.path.isfile(vp)} ({vp})")
    return 0


def main() -> int:
    if os.environ.get("CURSOR_HOOK_MECHANICUS_LAST_SENTENCE", "1").strip().lower() in (
        "0",
        "false",
        "no",
        "off",
    ):
        try:
            sys.stdin.buffer.read()
        except OSError:
            pass
        return 0

    raw_in = _read_stdin_text()
    if _cyberdeck_mutes_cursor_hook():
        _log("main: muted (mechanicus-cursor.muted)")
        return 0
    if not raw_in.strip():
        _log("main: empty stdin")
        return 0
    if os.environ.get("CURSOR_HOOK_MECHANICUS_DEBUG", "").strip() in ("1", "true", "yes"):
        _log(f"main: stdin head={raw_in[:800]!r}")
    data = _parse_json_object(raw_in)
    if not data:
        head = raw_in[:200].replace("\r", "\\r").replace("\n", "\\n")
        _log(f"main: bad JSON (len={len(raw_in)} head={head!r})")
        return 0

    full = _extract_full_text(data)
    snippet = last_sentence(full)
    if not snippet:
        _log(f"main: no snippet (text len={len(full)}) keys={list(data.keys())[:12]}")
        return 0

    voice_profile = _read_cursor_hook_voice_profile()
    _log(f"main: snippet={snippet[:120]!r} voice={voice_profile}")

    root, vp = _resolve_voice_profile_helper()
    if not os.path.isfile(vp):
        _log(f"missing voice_profile: {vp}")
        print(f"[mechanicus-hook] missing voice_profile: {vp}", file=sys.stderr)
        return 0

    # Windows: avoid DETACHED_PROCESS by default — it can leave pygame/WASAPI with no audible
    # default endpoint even though the child starts. Prefer job breakaway so playback survives
    # hook exit without a full console detach. Override with CURSOR_HOOK_MECHANICUS_DETACHED=1.
    creationflags = 0
    use_detached = False
    if sys.platform == "win32":
        no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        use_detached = os.environ.get(
            "CURSOR_HOOK_MECHANICUS_DETACHED", ""
        ).strip().lower() in ("1", "true", "yes", "on")
        if use_detached:
            creationflags = 0x00000008 | 0x00000200 | no_win  # DETACHED | NEW_GROUP
        else:
            creationflags = getattr(
                subprocess, "CREATE_BREAKAWAY_FROM_JOB", 0
            ) | no_win

    popen_kw: dict = {
        "cwd": root,
        "env": os.environ.copy(),
        "stdin": subprocess.DEVNULL,
        "stdout": subprocess.DEVNULL,
        "close_fds": False if sys.platform == "win32" else True,
    }

    tts_log = open(_TTS_STDERR_PATH, "a", encoding="utf-8")
    try:
        tts_log.write(f"\n--- TTS stderr {time.strftime('%Y-%m-%dT%H:%M:%S')} ---\n")
        tts_log.flush()
        popen_kw["stderr"] = tts_log
        vol = _read_cursor_tts_volume_override()
        cmd = [sys.executable, vp, "speak", voice_profile]
        # Use `--volume=-25%` (one token). A separate `-25%` argv is parsed as another flag
        # because it starts with '-', which makes voice_profile.py exit before any audio.
        if vol:
            cmd.append(f"--volume={vol}")
        cmd.append(snippet)
        try:
            proc = subprocess.Popen(
                cmd,
                creationflags=creationflags,
                **popen_kw,
            )
        except OSError as e:
            if sys.platform == "win32" and not use_detached:
                _log(f"Popen breakaway failed ({e}); retrying detached spawn")
                creationflags = 0x00000008 | 0x00000200 | getattr(
                    subprocess, "CREATE_NO_WINDOW", 0
                )
                proc = subprocess.Popen(cmd, creationflags=creationflags, **popen_kw)
            else:
                raise
    except OSError as e:
        _log(f"Popen failed: {e}")
        print(f"[mechanicus-hook] could not start TTS: {e}", file=sys.stderr)
        return 0
    finally:
        tts_log.close()

    _log(f"spawned child pid={proc.pid}")
    return 0


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        raise SystemExit(self_test())
    if "--dry-run" in sys.argv:
        raise SystemExit(dry_run())
    raise SystemExit(main())
