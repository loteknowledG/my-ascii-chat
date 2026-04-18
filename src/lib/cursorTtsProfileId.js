/** Samus `voice_profile speak` id + hook file `cursor-tts-voice.txt` (slug, lowercase). */
const CURSOR_TTS_PROFILE_ID_RE = /^[a-z][a-z0-9-]{0,62}$/;

export function isValidCursorTtsProfileId(id) {
  return typeof id === "string" && CURSOR_TTS_PROFILE_ID_RE.test(id.trim());
}
