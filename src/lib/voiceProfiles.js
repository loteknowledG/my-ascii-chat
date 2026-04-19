export const voiceProfiles = [
  {
    id: "jenna-jacket",
    label: "Jeena Jacket",
    description: "Friendly default operator profile.",
    browserVoice: "en-US-JennyNeural",
    nativeVoice: "Microsoft Zira Desktop - English (United States)",
    forceNativeTTS: false,
    rate: 0.81,
    pitch: 0.91,
    volume: 0.96,
    ttsRate: -19,
    ttsPitch: -9,
    ttsVolume: 2,
    effect: "",
    aliases: ["jenna", "jeena", "jacket", "assistant", "friendly"],
  },
  {
    id: "mechanicus-voice",
    label: "Tech Priest",
    description: "Dark, ritualistic machine-liturgy voice for sci-fi narration.",
    browserVoice: "en-US-AndrewNeural",
    nativeVoice: "Microsoft David Desktop - English (United States)",
    forceNativeTTS: false,
    rate: 0.72,
    pitch: 0.76,
    volume: 0.96,
    ttsRate: -24,
    ttsPitch: -10,
    ttsVolume: 0,
    effect: "mechanicus",
    aliases: ["mechanicus", "machine liturgy", "tech priest", "adeptus mechanicus", "war chant"],
  },
  {
    id: "codex-scribe",
    label: "Codex Datasmith Scribe",
    description: "Cold archive voice with metallic circuitry and binary chatter for Codex commentary, recall, and datasmith-litany output.",
    browserVoice: "en-US-AriaNeural",
    nativeVoice: "Microsoft David Desktop - English (United States)",
    forceNativeTTS: false,
    rate: 0.86,
    pitch: 0.72,
    volume: 0.97,
    ttsRate: -10,
    ttsPitch: -5,
    ttsVolume: 1,
    effect: "codex",
    aliases: ["codex", "scribe", "archive", "vault", "librarian"],
  },
  {
    id: "warp-spider",
    label: "Warp Spider",
    description:
      "Small-engine / lawnmower talk: low roar, idle pulse + fast buzz, short metal ring, grain; slips (up to 4× / 4 words, rarer at max).",
    browserVoice: "en-US-GuyNeural",
    nativeVoice: "Microsoft Zira Desktop - English (United States)",
    forceNativeTTS: false,
    rate: 1.18,
    pitch: 1.34,
    volume: 0.96,
    ttsRate: -10,
    ttsPitch: -5,
    ttsVolume: 5,
    effect: "warp-spider",
    aliases: ["warp spider", "warp-spider", "warp", "phase voice", "flicker voice"],
  },
];

export const languageProfiles = [
  ["af-ZA", "Afrikaans"],
  ["am-ET", "Amharic"],
  ["ar-AE", "Arabic (UAE)"],
  ["ar-BH", "Arabic (Bahrain)"],
  ["ar-DZ", "Arabic (Algeria)"],
  ["ar-EG", "Arabic (Egypt)"],
  ["ar-IQ", "Arabic (Iraq)"],
  ["ar-JO", "Arabic (Jordan)"],
  ["ar-KW", "Arabic (Kuwait)"],
  ["ar-LB", "Arabic (Lebanon)"],
  ["ar-LY", "Arabic (Libya)"],
  ["ar-MA", "Arabic (Morocco)"],
  ["ar-OM", "Arabic (Oman)"],
  ["ar-QA", "Arabic (Qatar)"],
  ["ar-SA", "Arabic (Saudi Arabia)"],
  ["ar-SY", "Arabic (Syria)"],
  ["ar-TN", "Arabic (Tunisia)"],
  ["ar-YE", "Arabic (Yemen)"],
  ["az-AZ", "Azerbaijani"],
  ["bn-BD", "Bengali (Bangladesh)"],
  ["bn-IN", "Bengali (India)"],
  ["bs-BA", "Bosnian"],
  ["bg-BG", "Bulgarian"],
  ["my-MM", "Burmese"],
  ["ca-ES", "Catalan"],
  ["zh-CN", "Chinese (Simplified)"],
  ["zh-CN-liaoning", "Chinese (Liaoning)"],
  ["zh-CN-shaanxi", "Chinese (Shaanxi)"],
  ["zh-HK", "Chinese (Hong Kong)"],
  ["zh-TW", "Chinese (Traditional)"],
  ["hr-HR", "Croatian"],
  ["cs-CZ", "Czech"],
  ["da-DK", "Danish"],
  ["nl-BE", "Dutch (Belgium)"],
  ["nl-NL", "Dutch (Netherlands)"],
  ["en-AU", "English (Australia)"],
  ["en-CA", "English (Canada)"],
  ["en-GB", "English (UK)"],
  ["en-HK", "English (Hong Kong)"],
  ["en-IE", "English (Ireland)"],
  ["en-IN", "English (India)"],
  ["en-KE", "English (Kenya)"],
  ["en-NG", "English (Nigeria)"],
  ["en-NZ", "English (New Zealand)"],
  ["en-PH", "English (Philippines)"],
  ["en-SG", "English (Singapore)"],
  ["en-ZA", "English (South Africa)"],
  ["en-TZ", "English (Tanzania)"],
  ["en-US", "English (US)"],
  ["et-EE", "Estonian"],
  ["fil-PH", "Filipino"],
  ["fi-FI", "Finnish"],
  ["fr-BE", "French (Belgium)"],
  ["fr-CA", "French (Canada)"],
  ["fr-CH", "French (Switzerland)"],
  ["fr-FR", "French (France)"],
  ["gl-ES", "Galician"],
  ["ka-GE", "Georgian"],
  ["de-AT", "German (Austria)"],
  ["de-DE", "German (Germany)"],
  ["de-CH", "German (Switzerland)"],
  ["el-GR", "Greek"],
  ["gu-IN", "Gujarati"],
  ["he-IL", "Hebrew"],
  ["hi-IN", "Hindi"],
  ["hu-HU", "Hungarian"],
  ["is-IS", "Icelandic"],
  ["id-ID", "Indonesian"],
  ["ga-IE", "Irish"],
  ["it-IT", "Italian"],
  ["ja-JP", "Japanese"],
  ["jv-ID", "Javanese"],
  ["kn-IN", "Kannada"],
  ["kk-KZ", "Kazakh"],
  ["km-KH", "Khmer"],
  ["ko-KR", "Korean"],
  ["lo-LA", "Lao"],
  ["lv-LV", "Latvian"],
  ["lt-LT", "Lithuanian"],
  ["mk-MK", "Macedonian"],
  ["ms-MY", "Malay"],
  ["ml-IN", "Malayalam"],
  ["mt-MT", "Maltese"],
  ["mr-IN", "Marathi"],
  ["mn-MN", "Mongolian"],
  ["ne-NP", "Nepali"],
  ["nb-NO", "Norwegian Bokmål"],
  ["ps-AF", "Pashto"],
  ["fa-IR", "Persian"],
  ["pl-PL", "Polish"],
  ["pt-BR", "Portuguese (Brazil)"],
  ["pt-PT", "Portuguese (Portugal)"],
  ["ro-RO", "Romanian"],
  ["ru-RU", "Russian"],
  ["sr-RS", "Serbian"],
  ["si-LK", "Sinhala"],
  ["sk-SK", "Slovak"],
  ["sl-SI", "Slovenian"],
  ["so-SO", "Somali"],
  ["es-AR", "Spanish (Argentina)"],
  ["es-BO", "Spanish (Bolivia)"],
  ["es-CL", "Spanish (Chile)"],
  ["es-CO", "Spanish (Colombia)"],
  ["es-CR", "Spanish (Costa Rica)"],
  ["es-CU", "Spanish (Cuba)"],
  ["es-DO", "Spanish (Dominican Republic)"],
  ["es-EC", "Spanish (Ecuador)"],
  ["es-SV", "Spanish (El Salvador)"],
  ["es-GQ", "Spanish (Equatorial Guinea)"],
  ["es-GT", "Spanish (Guatemala)"],
  ["es-HN", "Spanish (Honduras)"],
  ["es-MX", "Spanish (Mexico)"],
  ["es-NI", "Spanish (Nicaragua)"],
  ["es-PA", "Spanish (Panama)"],
  ["es-PY", "Spanish (Paraguay)"],
  ["es-PE", "Spanish (Peru)"],
  ["es-PR", "Spanish (Puerto Rico)"],
  ["es-ES", "Spanish (Spain)"],
  ["es-US", "Spanish (US)"],
  ["es-UY", "Spanish (Uruguay)"],
  ["es-VE", "Spanish (Venezuela)"],
  ["su-ID", "Sundanese"],
  ["sw-KE", "Swahili (Kenya)"],
  ["sw-TZ", "Swahili (Tanzania)"],
  ["sv-SE", "Swedish"],
  ["ta-IN", "Tamil (India)"],
  ["ta-LK", "Tamil (Sri Lanka)"],
  ["ta-MY", "Tamil (Malaysia)"],
  ["ta-SG", "Tamil (Singapore)"],
  ["te-IN", "Telugu"],
  ["th-TH", "Thai"],
  ["tr-TR", "Turkish"],
  ["uk-UA", "Ukrainian"],
  ["ur-IN", "Urdu (India)"],
  ["ur-PK", "Urdu (Pakistan)"],
  ["uz-UZ", "Uzbek"],
  ["vi-VN", "Vietnamese"],
  ["cy-GB", "Welsh"],
  ["zu-ZA", "Zulu"],
];

export const languageVoiceCatalog = {
  "en-US": [
    ["AnaNeural", "Female"],
    ["AndrewMultilingualNeural", "Male"],
    ["AndrewNeural", "Male"],
    ["AriaNeural", "Female"],
    ["AvaMultilingualNeural", "Female"],
    ["AvaNeural", "Female"],
    ["BrianMultilingualNeural", "Male"],
    ["BrianNeural", "Male"],
    ["ChristopherNeural", "Male"],
    ["EmmaMultilingualNeural", "Female"],
    ["EmmaNeural", "Female"],
    ["EricNeural", "Male"],
    ["GuyNeural", "Male"],
    ["JennyNeural", "Female"],
    ["MichelleNeural", "Female"],
    ["RogerNeural", "Male"],
    ["SteffanNeural", "Male"],
  ],
  "en-GB": [
    ["LibbyNeural", "Female"],
    ["MaisieNeural", "Female"],
    ["RyanNeural", "Male"],
    ["SoniaNeural", "Female"],
    ["ThomasNeural", "Male"],
  ],
  "en-AU": [["NatashaNeural", "Female"], ["WilliamNeural", "Male"]],
  "fr-FR": [
    ["DeniseNeural", "Female"],
    ["EloiseNeural", "Female"],
    ["HenriNeural", "Male"],
    ["RemyMultilingualNeural", "Male"],
    ["VivienneMultilingualNeural", "Female"],
  ],
  "de-DE": [
    ["AmalaNeural", "Female"],
    ["ConradNeural", "Male"],
    ["FlorianMultilingualNeural", "Male"],
    ["KatjaNeural", "Female"],
    ["KillianNeural", "Male"],
    ["SeraphinaMultilingualNeural", "Female"],
  ],
  "es-ES": [["AlvaroNeural", "Male"], ["ElviraNeural", "Female"]],
  "ja-JP": [["KeitaNeural", "Male"], ["NanamiNeural", "Female"]],
  "zh-CN": [
    ["XiaoxiaoNeural", "Female"],
    ["XiaoyiNeural", "Female"],
    ["YunjianNeural", "Male"],
    ["YunxiNeural", "Male"],
    ["YunxiaNeural", "Male"],
    ["YunyangNeural", "Male"],
  ],
  "zh-HK": [["HiuGaaiNeural", "Female"], ["HiuMaanNeural", "Female"], ["WanLungNeural", "Male"]],
  "ko-KR": [["HyunsuMultilingualNeural", "Male"], ["InJoonNeural", "Male"], ["SunHiNeural", "Female"]],
  "it-IT": [
    ["DiegoNeural", "Male"],
    ["ElsaNeural", "Female"],
    ["GiuseppeMultilingualNeural", "Male"],
    ["IsabellaNeural", "Female"],
  ],
  "pt-BR": [["AntonioNeural", "Male"], ["FranciscaNeural", "Female"]],
  "ar-SA": [["HamedNeural", "Male"], ["ZariyahNeural", "Female"]],
  "ru-RU": [["DmitryNeural", "Male"], ["SvetlanaNeural", "Female"]],
};

export const CUSTOM_VOICE_PROFILES_KEY = "wyc_custom_voice_profiles_v1";
const DEFAULT_MODEL_MODE = "tts";
const DEFAULT_LANGUAGE = "en-US";

function normalizeVoiceProfile(profile) {
  if (!profile) return profile;
  return {
    ...profile,
    modelMode: profile.modelMode || DEFAULT_MODEL_MODE,
    language: profile.language || DEFAULT_LANGUAGE,
  };
}

function readStoredVoiceProfiles() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_VOICE_PROFILES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function slugifyVoiceProfileId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * True for UI “duplicate preset” noise (Cursor/VS style names, trailing “ copy”, id suffix -copy).
 * Keeps those entries out of the Cursor hook voice wheel without deleting localStorage presets.
 */
export function isDuplicateStyleVoiceName(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  if (/(?:\s+copy)+$/i.test(s)) return true;
  if (/(?:-copy)+$/i.test(s)) return true;
  if (/\bcopy\s+of\b/i.test(s)) return true;
  if (/\bimmutable\s+copy\b/i.test(s)) return true;
  return false;
}

export function getAllVoiceProfiles() {
  return [...voiceProfiles.map(normalizeVoiceProfile), ...readStoredVoiceProfiles().map(normalizeVoiceProfile)];
}

export function getBaseVoiceProfiles() {
  return voiceProfiles.map(normalizeVoiceProfile);
}

export function saveVoiceProfilePreset({
  id,
  label,
  description,
  speakMode = "conversation",
  speakerMode = "auto",
  modelMode = DEFAULT_MODEL_MODE,
  language = DEFAULT_LANGUAGE,
  browserVoice,
  nativeVoice,
  forceNativeTTS = false,
  rate,
  pitch,
  volume,
  ttsRate,
  ttsPitch,
  ttsVolume,
  effect = "",
  aliases = [],
}) {
  if (typeof window === "undefined") {
    return null;
  }

  const presetId = slugifyVoiceProfileId(id);
  if (!presetId) {
    throw new Error("Voice preset id is required");
  }

  const preset = {
    id: presetId,
    label: label || id || presetId,
    description:
      description ||
      `Saved preset tuned from ${label || browserVoice || nativeVoice || presetId}.`,
    speakMode: String(speakMode || "conversation"),
    speakerMode: String(speakerMode || "auto"),
    modelMode: String(modelMode || DEFAULT_MODEL_MODE),
    language: String(language || DEFAULT_LANGUAGE),
    browserVoice: browserVoice || nativeVoice || "",
    nativeVoice: nativeVoice || browserVoice || "",
    forceNativeTTS: Boolean(forceNativeTTS),
    rate,
    pitch,
    volume,
    ttsRate,
    ttsPitch,
    ttsVolume,
    effect: effect || "",
    aliases: Array.from(new Set([presetId, ...(aliases || [])].flat().filter(Boolean))),
  };

  const current = readStoredVoiceProfiles();
  const next = [
    ...current.filter((entry) => entry?.id !== preset.id),
    preset,
  ];
  window.localStorage.setItem(CUSTOM_VOICE_PROFILES_KEY, JSON.stringify(next));
  return preset;
}

export function resolveVoiceProfile(profileName = "") {
  const key = String(profileName || "").trim().toLowerCase();
  const allProfiles = getAllVoiceProfiles();
  const aliasMap = Object.fromEntries(
    allProfiles.flatMap((profile) => [
      [profile.id, profile.id],
      ...(profile.aliases || []).map((alias) => [String(alias).toLowerCase(), profile.id]),
    ]),
  );
  const normalized = aliasMap[key] || key;
  return normalizeVoiceProfile(allProfiles.find((profile) => profile.id === normalized) || allProfiles[0]);
}

export function getVoiceProfileOptions() {
  return getAllVoiceProfiles().map((profile) => ({
    label: profile.label,
    value: profile.id,
    textValue: `${profile.label} ${profile.description} ${profile.id}`,
  }));
}

export function getBaseVoiceProfileOptions() {
  return getBaseVoiceProfiles().map((profile) => ({
    label: profile.label,
    value: profile.id,
    textValue: `${profile.label} ${profile.description} ${profile.id}`,
  }));
}

export function getLanguageOptions() {
  return languageProfiles.map(([value, label]) => ({
    label,
    value,
    textValue: `${label} ${value}`,
  }));
}

export function getLanguageVoiceOptions(language) {
  const key = String(language || DEFAULT_LANGUAGE);
  const voices = languageVoiceCatalog[key] || [];
  return voices.map(([voiceName, gender]) => ({
    label: `${voiceName}${gender ? ` (${gender})` : ""}`,
    value: `${key}-${voiceName}`,
    textValue: `${voiceName} ${gender || ""} ${key}`,
  }));
}
