#!/usr/bin/env python3
"""Local voice profile helper for Weyland-Yutani Cyberdeck.

Ported from Samus-Manus so this repo can run voice commands without hard
depending on C:\\dev\\samus-manus.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import tempfile
import time


VOICE_PROFILE_TIMEOUT_SEC = float(os.environ.get("VOICE_PROFILE_TIMEOUT_SEC", "120"))

PROFILES = {
    "mechanicus-voice": {
        "profile": "mechanicus-voice",
        "label": "Mechanicus Voice",
        "bootup_ai_name": "Mechanicus Voice",
        "bootup_voice": "en-US-AndrewNeural",
        "bootup_tts_rate": "-24%",
        "bootup_tts_pitch": "-10Hz",
        "bootup_tts_volume": "+0%",
        "description": "Dark, ritualistic machine-liturgy voice for ominous sci-fi narration.",
    },
    "warp-spider": {
        "profile": "warp-spider",
        "label": "Warp Spider",
        "bootup_ai_name": "Warp Spider",
        "bootup_voice": "en-US-GuyNeural",
        "bootup_tts_rate": "-10%",
        "bootup_tts_pitch": "-5Hz",
        "bootup_tts_volume": "+5%",
        "description": "Fast, unstable voice profile for phase-shifted responses.",
    },
    "jenny-neural": {
        "profile": "jenny-neural",
        "label": "Jenny Neural",
        "bootup_ai_name": "Jenny Neural",
        "bootup_voice": "en-US-JennyNeural",
        "bootup_tts_rate": "-5%",
        "bootup_tts_pitch": "-2Hz",
        "bootup_tts_volume": "+0%",
        "description": "Cleaner voice-forward mode with lighter stylization.",
    },
}

ALIASES = {
    "mechanicus": "mechanicus-voice",
    "machine liturgy": "mechanicus-voice",
    "tech priest": "mechanicus-voice",
    "adeptus mechanicus": "mechanicus-voice",
    "war chant": "mechanicus-voice",
    "warp": "warp-spider",
    "warp spider": "warp-spider",
    "jenny": "jenny-neural",
    "neural": "jenny-neural",
}


def resolve_profile(name: str) -> dict:
    key = (name or "").strip().lower()
    key = ALIASES.get(key, key)
    if key not in PROFILES:
        raise KeyError(f"Unknown voice profile: {name}")
    return PROFILES[key]


def profile_env(
    profile: dict,
    rate: str | None = None,
    pitch: str | None = None,
    volume: str | None = None,
) -> dict[str, str]:
    env = {
        "BOOTUP_AI_NAME": profile["bootup_ai_name"],
        "BOOTUP_VOICE": profile["bootup_voice"],
    }
    env["BOOTUP_TTS_RATE"] = rate if rate not in (None, "") else profile.get("bootup_tts_rate", "")
    env["BOOTUP_TTS_PITCH"] = pitch if pitch not in (None, "") else profile.get("bootup_tts_pitch", "")
    env["BOOTUP_TTS_VOLUME"] = volume if volume not in (None, "") else profile.get("bootup_tts_volume", "")
    return env


async def _speak(
    text: str,
    voice: str,
    rate: str | None,
    pitch: str | None,
    volume: str | None,
) -> bool:
    try:
        import edge_tts
        import pygame
    except Exception as exc:
        print(f"[VOICE] Missing audio dependency: {exc}", file=sys.stderr)
        return False

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        out_path = tmp.name

    try:
        communicate = edge_tts.Communicate(
            text,
            voice,
            rate=rate or "",
            pitch=pitch or "",
            volume=volume or "",
        )
        await asyncio.wait_for(communicate.save(out_path), timeout=VOICE_PROFILE_TIMEOUT_SEC)
        pygame.mixer.init()
        pygame.mixer.music.load(out_path)
        pygame.mixer.music.play()
        started = time.monotonic()
        while pygame.mixer.music.get_busy():
            if time.monotonic() - started > VOICE_PROFILE_TIMEOUT_SEC:
                pygame.mixer.music.stop()
                raise TimeoutError("Playback timed out")
            pygame.time.Clock().tick(10)
        return True
    finally:
        try:
            pygame.mixer.quit()  # type: ignore[name-defined]
        except Exception:
            pass
        try:
            os.remove(out_path)
        except Exception:
            pass


def list_profiles() -> int:
    for name, profile in PROFILES.items():
        print(f"{name:16} -> {profile['bootup_ai_name']} / {profile['bootup_voice']}")
        print(f"  {profile['description']}")
    return 0


def show_profile(profile_name: str) -> int:
    print(json.dumps(resolve_profile(profile_name), indent=2))
    return 0


def speak_profile(
    profile_name: str,
    text: str,
    rate: str | None = None,
    pitch: str | None = None,
    volume: str | None = None,
) -> int:
    profile = resolve_profile(profile_name)
    env = profile_env(profile, rate=rate, pitch=pitch, volume=volume)
    print(
        f"[VOICE] Speaking with profile '{profile['profile']}' "
        f"({profile['bootup_voice']}): {text}",
        flush=True,
    )
    ok = asyncio.run(
        _speak(
            text,
            env["BOOTUP_VOICE"],
            env.get("BOOTUP_TTS_RATE"),
            env.get("BOOTUP_TTS_PITCH"),
            env.get("BOOTUP_TTS_VOLUME"),
        )
    )
    return 0 if ok else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Voice profile helper for Cyberdeck")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("list", help="List known profiles")
    p.set_defaults(func=lambda _: list_profiles())

    p = sub.add_parser("show", help="Show a single profile as JSON")
    p.add_argument("profile", help="Profile name or alias")
    p.set_defaults(func=lambda args: show_profile(args.profile))

    p = sub.add_parser("speak", help="Speak text using a profile")
    p.add_argument("profile", help="Profile name or alias")
    p.add_argument("--rate", help="Optional TTS rate override")
    p.add_argument("--pitch", help="Optional TTS pitch override")
    p.add_argument("--volume", help="Optional TTS volume override")
    p.add_argument("text", nargs="+", help="Text to speak")
    p.set_defaults(
        func=lambda args: speak_profile(
            args.profile, " ".join(args.text), args.rate, args.pitch, args.volume
        )
    )

    args = parser.parse_args()
    try:
        return int(args.func(args))
    except KeyError as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
