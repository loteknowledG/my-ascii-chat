const DEFAULT_TTS_BASE_URL = "https://aivoice.coderobo.org";
const DEFAULT_CORS_ANYWHERE_PROXY = "https://cors-anywhere-dqgj.onrender.com/";

/** In `vite dev`, use same-origin `/api/tts` (see `vite.config.ts` proxy) so profile voices work without a third-party CORS proxy. */
function defaultBrowserTtsBaseUrl() {
  if (import.meta.env?.DEV) return "";
  return import.meta.env?.VITE_TTS_BASE_URL?.trim?.() || DEFAULT_TTS_BASE_URL;
}

function isSameOriginFetchUrl(url) {
  if (typeof window === "undefined") return false;
  if (url.startsWith("/")) return true;
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

function getNodeRequire() {
  if (typeof window !== "undefined" && typeof window.require === "function") {
    return window.require;
  }
  if (typeof globalThis !== "undefined" && typeof globalThis.require === "function") {
    return globalThis.require;
  }
  return null;
}

export function canUseRemoteTts() {
  return Boolean(getNodeRequire() || typeof fetch === "function");
}

function postJsonWithNodeHttps(url, payload) {
  const nodeRequire = getNodeRequire();
  if (!nodeRequire) {
    throw new Error("Node bridge unavailable");
  }

  let https = null;
  try {
    https = nodeRequire("node:https");
  } catch {
    https = nodeRequire("https");
  }
  const body = JSON.stringify(payload);
  const target = new URL(url);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": globalThis.Buffer?.byteLength?.(body) ?? body.length,
        },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(responseBody);
          } catch (error) {
            reject(new Error(`Invalid TTS response: ${String(error?.message || error)}`));
            return;
          }
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(json?.error || `TTS request failed: HTTP ${res.statusCode}`));
            return;
          }
          resolve(json);
        });
      },
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function postJsonWithFetch(url, payload) {
  const fetchUrl = isSameOriginFetchUrl(url) ? url : `${DEFAULT_CORS_ANYWHERE_PROXY}${url}`;
  const response = await fetch(fetchUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(isSameOriginFetchUrl(url) ? {} : { "X-Requested-With": "XMLHttpRequest" }),
    },
    body: JSON.stringify(payload),
  });

  const responseBody = await response.text();
  let json = null;
  try {
    json = responseBody ? JSON.parse(responseBody) : {};
  } catch (error) {
    throw new Error(`Invalid TTS response: ${String(error?.message || error)}`);
  }

  if (!response.ok) {
    throw new Error(json?.error || `TTS request failed: HTTP ${response.status}`);
  }

  return json;
}

async function postJson(url, payload) {
  const nodeRequire = getNodeRequire();
  if (nodeRequire) {
    return postJsonWithNodeHttps(url, payload);
  }

  if (typeof fetch === "function") {
    return postJsonWithFetch(url, payload);
  }

  throw new Error("No transport available for remote TTS");
}

export async function requestRemoteTtsAudioUrl({
  text,
  voice,
  rate = 0,
  pitch = 0,
  baseUrl = defaultBrowserTtsBaseUrl(),
}) {
  const cleanedText = String(text || "").trim();
  if (!cleanedText) {
    throw new Error("Text is required");
  }

  const cleanedVoice = String(voice || "").trim();
  if (!cleanedVoice) {
    throw new Error("Voice is required");
  }

  const normalizedBase = String(baseUrl || "").replace(/\/+$/, "");
  const postPath = normalizedBase ? `${normalizedBase}/api/tts` : "/api/tts";
  const response = await postJson(postPath, {
    text: cleanedText,
    voice: cleanedVoice,
    rate,
    pitch,
  });

  const audioPath = String(response?.audio_url || response?.audio_path || "").trim();
  if (!audioPath) {
    throw new Error("TTS response did not include an audio URL");
  }

  const resolveBase =
    normalizedBase ||
    (typeof window !== "undefined" ? window.location.origin : DEFAULT_TTS_BASE_URL);
  return new URL(audioPath, `${resolveBase.replace(/\/+$/, "")}/`).toString();
}
