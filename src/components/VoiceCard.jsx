import React, { useEffect, useMemo, useRef, useState } from "react";
import AsciiStartStopButton from "./AsciiStartStopButton";
import { Knob } from "./ui/knob";
import { canUseRemoteTts, requestRemoteTtsAudioUrl } from "../lib/tts";
import { resolveVoiceProfile } from "../lib/voiceProfiles";

const DEFAULT_SAMPLE = "Hello, this is your cyberdeck speaking. Adjust the voice wheel and listen.";

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function normalizeVoiceName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function waitForSpeechVoices(synth, timeoutMs = 800) {
  return new Promise((resolve) => {
    const initialVoices = synth.getVoices?.() || [];
    if (initialVoices.length > 0) {
      resolve(initialVoices);
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      synth.removeEventListener?.("voiceschanged", finish);
      resolve(synth.getVoices?.() || []);
    };

    const timer = window.setTimeout(finish, timeoutMs);
    synth.addEventListener?.("voiceschanged", finish, { once: true });
  });
}

function pickBrowserVoice(voices, profile) {
  const candidateValues = [
    profile?.nativeVoice,
    profile?.browserVoice,
    profile?.label,
    profile?.id,
  ]
    .filter(Boolean)
    .map(normalizeVoiceName);

  for (const voice of voices) {
    const voiceName = normalizeVoiceName(voice?.name);
    const voiceUri = normalizeVoiceName(voice?.voiceURI);
    if (
      candidateValues.includes(voiceName) ||
      candidateValues.includes(voiceUri)
    ) {
      return voice;
    }
  }

  for (const voice of voices) {
    const voiceName = normalizeVoiceName(voice?.name);
    const voiceUri = normalizeVoiceName(voice?.voiceURI);
    if (
      candidateValues.some(
        (candidate) =>
          candidate &&
          (voiceName.includes(candidate) ||
            voiceUri.includes(candidate) ||
            candidate.includes(voiceName) ||
            candidate.includes(voiceUri)),
      )
    ) {
      return voice;
    }
  }

  return voices[0] || null;
}

function disconnectNode(node) {
  try {
    node?.disconnect?.();
  } catch {
    // Best effort cleanup only.
  }
}

function makeNoiseBuffer(context) {
  const durationSeconds = 1.5;
  const sampleRate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.max(1, Math.floor(sampleRate * durationSeconds)), sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i += 1) {
    channel[i] = (Math.random() * 2 - 1) * 0.35;
  }
  return buffer;
}

function makeDriveCurve(amount = 14) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const k = Number.isFinite(amount) ? amount : 14;
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    const ax = Math.abs(x);
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * ax);
  }
  return curve;
}

function createCodexElectricFx(context, audioElement, outputGainValue) {
  const source = context.createMediaElementSource(audioElement);
  const masterGain = context.createGain();
  const dryGain = context.createGain();
  const wetGain = context.createGain();
  const highPass = context.createBiquadFilter();
  const bandPass = context.createBiquadFilter();
  const notchA = context.createBiquadFilter();
  const notchB = context.createBiquadFilter();
  const shelf = context.createBiquadFilter();
  const lowPass = context.createBiquadFilter();
  const shaper = context.createWaveShaper();
  const noiseSource = context.createBufferSource();
  const noiseBandPass = context.createBiquadFilter();
  const noiseGain = context.createGain();
  const lfo = context.createOscillator();
  const lfoDepth = context.createGain();
  const flutter = context.createOscillator();
  const flutterDepth = context.createGain();
  const ringMod = context.createOscillator();
  const ringDepth = context.createGain();

  masterGain.gain.value = outputGainValue;
  dryGain.gain.value = 0.34;
  wetGain.gain.value = 0.66;
  highPass.type = "highpass";
  highPass.frequency.value = 480;
  bandPass.type = "bandpass";
  bandPass.frequency.value = 2920;
  bandPass.Q.value = 3.1;
  notchA.type = "notch";
  notchA.frequency.value = 1080;
  notchA.Q.value = 14;
  notchB.type = "notch";
  notchB.frequency.value = 2140;
  notchB.Q.value = 16;
  shelf.type = "highshelf";
  shelf.frequency.value = 4300;
  shelf.gain.value = 7;
  lowPass.type = "lowpass";
  lowPass.frequency.value = 6800;
  shaper.curve = makeDriveCurve(18);
  shaper.oversample = "4x";
  noiseSource.buffer = makeNoiseBuffer(context);
  noiseSource.loop = true;
  noiseBandPass.type = "bandpass";
  noiseBandPass.frequency.value = 6200;
  noiseBandPass.Q.value = 14;
  noiseGain.gain.value = 0.011;
  lfo.frequency.value = 9;
  lfoDepth.gain.value = 140;
  flutter.frequency.value = 14;
  flutterDepth.gain.value = 0.018;
  ringMod.type = "square";
  ringMod.frequency.value = 760;
  ringDepth.gain.value = 0.022;

  source.connect(dryGain);
  dryGain.connect(masterGain);

  source.connect(highPass);
  highPass.connect(bandPass);
  bandPass.connect(notchA);
  notchA.connect(notchB);
  notchB.connect(shaper);
  shaper.connect(shelf);
  shelf.connect(lowPass);
  lowPass.connect(wetGain);
  wetGain.connect(masterGain);

  noiseSource.connect(noiseBandPass);
  noiseBandPass.connect(noiseGain);
  noiseGain.connect(masterGain);

  lfo.connect(lfoDepth);
  lfoDepth.connect(bandPass.frequency);
  flutter.connect(flutterDepth);
  flutterDepth.connect(wetGain.gain);
  ringMod.connect(ringDepth);
  ringDepth.connect(masterGain.gain);

  masterGain.connect(context.destination);

  lfo.start();
  flutter.start();
  noiseSource.start();
  ringMod.start();

  return {
    audioContext: context,
    source,
    masterGain,
    dryGain,
    wetGain,
    highPass,
    bandPass,
    notchA,
    notchB,
    shelf,
    lowPass,
    shaper,
    noiseSource,
    noiseBandPass,
    noiseGain,
    lfo,
    lfoDepth,
    flutter,
    flutterDepth,
    ringMod,
    ringDepth,
  };
}

function teardownAudioFx(graph) {
  if (!graph) return;
  const stopNode = (node) => {
    try {
      node?.stop?.();
    } catch {
      // best effort
    }
  };

  stopNode(graph.lfo);
  stopNode(graph.flutter);
  stopNode(graph.noiseSource);

  disconnectNode(graph.source);
  disconnectNode(graph.masterGain);
  disconnectNode(graph.dryGain);
  disconnectNode(graph.wetGain);
  disconnectNode(graph.highPass);
  disconnectNode(graph.bandPass);
  disconnectNode(graph.notchA);
  disconnectNode(graph.notchB);
  disconnectNode(graph.shelf);
  disconnectNode(graph.lowPass);
  disconnectNode(graph.shaper);
  disconnectNode(graph.noiseBandPass);
  disconnectNode(graph.noiseGain);
  disconnectNode(graph.lfoDepth);
  disconnectNode(graph.flutterDepth);
  disconnectNode(graph.ringMod);
  disconnectNode(graph.ringDepth);

  try {
    graph.audioContext?.close?.();
  } catch {
    // best effort
  }
}

export default function VoiceCard({
  title = "VOICE CARD",
  accent = "#9bff9b",
  sampleText = DEFAULT_SAMPLE,
  profileOverride = null,
  defaultProfile = "jenna-jacket",
  previewOnProfileChange = false,
  showTextInput = true,
  compact = false,
  /** If neural TTS fails, auto-play Windows speech. Default false so demos stay quiet instead of embarrassing. */
  allowAutomaticBrowserFallback = false,
  style = {},
} = {}) {
  const [text, setText] = useState(sampleText);
  const [selectedVoiceProfileId, setSelectedVoiceProfileId] = useState(defaultProfile);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState("idle");
  /** Last successful speak path: `remote` = neural MP3; `browser` = Windows speech (robotic). */
  const [voiceEngine, setVoiceEngine] = useState(null);
  /** One-shot: user opted into Windows speech after a failed neural attempt. */
  const [sessionBrowserFallback, setSessionBrowserFallback] = useState(false);
  /** Human copy when neural TTS failed and we stayed silent on purpose. */
  const [remoteFailureHint, setRemoteFailureHint] = useState(null);
  const [volume, setVolume] = useState(100);
  const [availableVoices, setAvailableVoices] = useState(() =>
    typeof window !== "undefined" && window.speechSynthesis
      ? window.speechSynthesis.getVoices() || []
      : [],
  );
  const audioRef = useRef(null);
  const audioFxRef = useRef(null);
  const utteranceRef = useRef(null);
  const selectedProfileIdRef = useRef(null);
  const speakTokenRef = useRef(0);

  const selectedProfile = useMemo(
    () => profileOverride || resolveVoiceProfile(selectedVoiceProfileId),
    [profileOverride, selectedVoiceProfileId],
  );

  useEffect(() => {
    const profile = resolveVoiceProfile(defaultProfile);
    setSelectedVoiceProfileId(profile.id);
  }, [defaultProfile]);

  useEffect(() => {
    if (!profileOverride?.id) return;
    setSelectedVoiceProfileId(profileOverride.id);
  }, [profileOverride?.id]);

  useEffect(() => {
    if (selectedProfileIdRef.current === null) {
      selectedProfileIdRef.current = selectedProfile.id;
      return;
    }

    if (selectedProfileIdRef.current === selectedProfile.id) return;

    selectedProfileIdRef.current = selectedProfile.id;
    const shouldRestart =
      previewOnProfileChange ||
      speaking ||
      paused ||
      status === "loading" ||
      status === "speaking";

    const currentText = text.trim();
    if (!currentText) {
      stop();
      return;
    }

    if (!shouldRestart) return;

    stop();
    const timer = window.setTimeout(() => {
      void speak();
    }, 0);

    return () => window.clearTimeout(timer);
    // We intentionally key off the selected profile change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOnProfileChange, paused, speaking, status, text, selectedProfile.id]);

  useEffect(() => {
    setText(sampleText);
  }, [sampleText]);

  useEffect(() => {
    if (!window.speechSynthesis) return;

    const synth = window.speechSynthesis;
    const updateVoices = () => {
      setAvailableVoices(synth.getVoices() || []);
    };

    updateVoices();
    synth.addEventListener?.("voiceschanged", updateVoices);

    return () => {
      synth.removeEventListener?.("voiceschanged", updateVoices);
    };
  }, []);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.src = "";
        audioRef.current = null;
      }
      teardownAudioFx(audioFxRef.current);
      audioFxRef.current = null;
    };
  }, []);

  /** Remote TTS uses HTMLAudioElement — volume can change while playing. Browser SpeechSynthesis applies on next speak only. */
  useEffect(() => {
    const graph = audioFxRef.current;
    if (graph?.masterGain) {
      graph.masterGain.gain.value = clamp01(volume / 100);
    }
    const a = audioRef.current;
    if (a && !graph) {
      a.volume = clamp01(volume / 100);
    }
  }, [volume]);

  const stop = () => {
    speakTokenRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
      audioRef.current = null;
    }

    teardownAudioFx(audioFxRef.current);
    audioFxRef.current = null;

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setSpeaking(false);
    setPaused(false);
    setStatus("idle");
    setRemoteFailureHint(null);
  };

  const pause = () => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
      setPaused(true);
      setSpeaking(true);
      setStatus("paused");
      return;
    }

    if (window.speechSynthesis?.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setPaused(true);
      setSpeaking(true);
      setStatus("paused");
    }
  };

  const resume = () => {
    const audio = audioRef.current;
    if (audio && audio.paused && !audio.ended) {
      void audio.play();
      setPaused(false);
      setSpeaking(true);
      setStatus("speaking");
      return;
    }

    if (window.speechSynthesis?.paused) {
      window.speechSynthesis.resume();
      setPaused(false);
      setSpeaking(true);
      setStatus("speaking");
    }
  };

  const playBrowserFallback = async (opts = {}) => {
    const { clearSessionOptInOnEnd = false } = opts;
    const token = speakTokenRef.current;
    if (!window.speechSynthesis) {
      throw new Error("Browser speech unavailable");
    }

    const synth = window.speechSynthesis;
    const voices =
      availableVoices.length > 0
        ? availableVoices
        : await waitForSpeechVoices(synth);
    const fallbackVoice = pickBrowserVoice(voices, selectedProfile);

    synth.cancel();
    const utter = new window.SpeechSynthesisUtterance(text);
    utteranceRef.current = utter;
    if (fallbackVoice) utter.voice = fallbackVoice;
    utter.rate = selectedProfile.rate ?? 1;
    utter.pitch = selectedProfile.pitch ?? 1;
    utter.volume = clamp01(volume / 100);
    utter.onstart = () => {
      if (token !== speakTokenRef.current) return;
      setVoiceEngine("browser");
      setSpeaking(true);
      setPaused(false);
      setStatus("speaking");
    };
    utter.onpause = () => {
      if (token !== speakTokenRef.current) return;
      setPaused(true);
      setStatus("paused");
    };
    utter.onresume = () => {
      if (token !== speakTokenRef.current) return;
      setPaused(false);
      setStatus("speaking");
    };
    utter.onend = () => {
      if (token !== speakTokenRef.current) return;
      setSpeaking(false);
      setPaused(false);
      setStatus("idle");
      if (clearSessionOptInOnEnd) {
        setSessionBrowserFallback(false);
      }
    };
    utter.onerror = () => {
      if (token !== speakTokenRef.current) return;
      setSpeaking(false);
      setPaused(false);
      setStatus("error");
      if (clearSessionOptInOnEnd) {
        setSessionBrowserFallback(false);
      }
    };
    synth.speak(utter);
  };

  const playRemoteTts = async () => {
    const token = speakTokenRef.current;
    const audioUrl = await requestRemoteTtsAudioUrl({
      text,
      voice: selectedProfile.browserVoice,
      rate: selectedProfile.ttsRate ?? 0,
      pitch: selectedProfile.ttsPitch ?? 0,
    });

    if (token !== speakTokenRef.current) return;

    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.src = audioUrl;
    audioRef.current = audio;
    const outputGainValue = clamp01(volume / 100);
    const useElectricFx = selectedProfile.effect === "codex";
    if (useElectricFx && typeof window.AudioContext !== "undefined") {
      try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        audioFxRef.current = createCodexElectricFx(context, audio, outputGainValue);
      } catch (error) {
        console.warn("VOICE_CODEX_FX_FALLBACK", error);
        audio.volume = outputGainValue;
      }
    } else {
      audio.volume = outputGainValue;
    }

    audio.onplay = () => {
      if (token !== speakTokenRef.current) return;
      setVoiceEngine("remote");
      setSpeaking(true);
      setPaused(false);
      setStatus("speaking");
    };
    audio.onpause = () => {
      if (token !== speakTokenRef.current) return;
      if (audio.currentTime > 0 && !audio.ended) {
        setPaused(true);
        setStatus("paused");
      }
    };
    audio.onended = () => {
      if (token !== speakTokenRef.current) return;
      setSpeaking(false);
      setPaused(false);
      setStatus("idle");
      audioRef.current = null;
      teardownAudioFx(audioFxRef.current);
      audioFxRef.current = null;
    };
    audio.onerror = () => {
      if (token !== speakTokenRef.current) return;
      setSpeaking(false);
      setPaused(false);
      setStatus("error");
      audioRef.current = null;
      teardownAudioFx(audioFxRef.current);
      audioFxRef.current = null;
    };

    await audio.play();
  };

  const speak = async () => {
    if (!text.trim()) return;
    stop();
    const token = speakTokenRef.current;
    setRemoteFailureHint(null);
    setStatus("loading");

    const mayUseRoboticFallback =
      allowAutomaticBrowserFallback || sessionBrowserFallback;

    try {
      if (token !== speakTokenRef.current) return;
      if (!selectedProfile.forceNativeTTS && canUseRemoteTts()) {
        await playRemoteTts();
        return;
      }
      await playBrowserFallback();
    } catch (error) {
      console.error("VOICE_TTS_ERROR", error);
      if (token !== speakTokenRef.current) return;
      setSpeaking(false);
      setPaused(false);
      if (!selectedProfile.forceNativeTTS && mayUseRoboticFallback) {
        setStatus("loading");
        try {
          await playBrowserFallback({
            clearSessionOptInOnEnd: sessionBrowserFallback,
          });
        } catch (fallbackError) {
          console.error("VOICE_FALLBACK_ERROR", fallbackError);
          setStatus("error");
          setRemoteFailureHint(
            "Neural and Windows speech both failed — still silent. Check the console.",
          );
        }
      } else if (!selectedProfile.forceNativeTTS) {
        setStatus("error");
        setRemoteFailureHint(
          "Neural voice did not load — nothing was played on purpose so you do not get the robotic Windows voice in front of people. Run pnpm dev (local TTS proxy) or fix the network, then try again.",
        );
      } else {
        setStatus("error");
      }
    }
  };

  const profileHint =
    selectedProfile.description ||
    (selectedProfile.effect ? `Effect: ${selectedProfile.effect}` : "");
  const spokenText = text.trim() || DEFAULT_SAMPLE;
  const screenTitle = speaking ? "SPEAKING" : "WORDS TO SAY";

  const shellStyle = {
    display: "flex",
    flexDirection: "column",
    gap: compact ? 6 : 12,
    padding: compact ? "6px" : "10px",
    border: `1px solid ${accent}33`,
    borderRadius: "16px",
    background: "linear-gradient(180deg, rgba(8,8,8,0.98), rgba(4,4,4,0.98))",
    boxShadow: `0 0 0 1px ${accent}12 inset`,
    height: "100%",
    /** In grid tiles, `min-height: 100%` fights the parent flex budget and can paint overlapping siblings. */
    minHeight: compact ? 0 : "auto",
    overflow: compact ? "hidden" : "auto",
    ...style,
  };

  const windowsFallbackHint =
    voiceEngine === "browser" ? (
      <div
        style={{
          marginTop: 6,
          color: "#c9a227",
          fontSize: 9,
          lineHeight: 1.4,
          letterSpacing: "0.02em",
        }}
      >
        Robotic ‘Stephen Hawking’-style tone = <strong>Windows speech fallback</strong>, not the profile neural voice.
        For the real cast, run <span style={{ fontFamily: "monospace", color: "#d7ffd7" }}>pnpm dev</span> (local TTS
        proxy) or check the browser console for <span style={{ fontFamily: "monospace" }}>VOICE_TTS_ERROR</span>.
      </div>
    ) : null;

  const neuralFailurePanel = remoteFailureHint ? (
    <div style={{ marginTop: 8, width: "100%" }}>
      <div style={{ color: "#ffb38a", fontSize: 9, lineHeight: 1.45 }}>{remoteFailureHint}</div>
      <button
        type="button"
        onClick={() => {
          setSessionBrowserFallback(true);
          setRemoteFailureHint(null);
          void speak();
        }}
        style={{
          marginTop: 8,
          width: "100%",
          cursor: "pointer",
          borderRadius: 8,
          border: `1px solid ${accent}44`,
          background: "rgba(20, 12, 8, 0.95)",
          color: "#c9a227",
          fontFamily: "monospace",
          fontSize: 9,
          padding: "6px 8px",
          textAlign: "center",
        }}
      >
        Use Windows voice once (debug only)
      </button>
    </div>
  ) : null;

  const upstreamStatusInside =
    compact && !showTextInput ? (
      <div
        style={{
          marginTop: 2,
          paddingTop: 6,
          borderTop: `1px solid ${accent}18`,
          color: "#8a8a8a",
          fontSize: 10,
          letterSpacing: "0.04em",
        }}
      >
        Voice status: {status}
        {speaking ? " (active)" : ""}
        {windowsFallbackHint}
        {neuralFailurePanel}
      </div>
    ) : null;

  return (
    <div style={shellStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ color: accent, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {title}
        </div>
        <div style={{ fontSize: 10, color: "#7a7a7a" }} />
      </div>

      <div
        style={{
          display: "grid",
          gap: compact ? 6 : 8,
          padding: compact ? "8px 10px" : "10px 12px",
          borderRadius: 12,
          border: `1px solid ${accent}22`,
          background:
            "linear-gradient(180deg, rgba(10, 14, 10, 0.96), rgba(5, 6, 5, 0.98))",
          boxShadow: `0 0 0 1px ${accent}10 inset`,
          flex: compact ? "1 1 0%" : undefined,
          minWidth: 0,
          minHeight: compact ? 0 : 96,
          overflow: compact ? "auto" : undefined,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 10,
            color: accent,
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          <span>{screenTitle}</span>
          <span style={{ color: "#7a7a7a" }}>{speaking ? "live preview" : "queued line"}</span>
        </div>
        <div
          style={{
            minHeight: compact ? 22 : 40,
            maxHeight: compact ? 52 : 92,
            overflow: "auto",
            color: "#d7ffd7",
            fontFamily:
              '"Cascadia Mono", "Cascadia Code", Consolas, "Liberation Mono", "Courier New", ui-monospace, monospace',
            fontSize: compact ? 11 : 13,
            lineHeight: compact ? 1.35 : 1.45,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            textShadow: speaking ? "0 0 10px rgba(57, 255, 20, 0.18)" : "none",
          }}
        >
          {spokenText}
        </div>
      </div>

      {showTextInput ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type something to speak..."
          rows={compact ? 2 : 3}
          style={{
            width: "100%",
            fontFamily: "monospace",
            fontSize: compact ? 12 : 13,
            padding: compact ? 6 : 8,
            borderRadius: 10,
            border: `1px solid ${accent}22`,
            resize: "vertical",
            background: "rgba(9, 9, 9, 0.96)",
            color: "#d7ffd7",
            minHeight: compact ? 34 : 72,
            boxShadow: `0 0 0 1px ${accent}08 inset`,
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            minHeight: compact ? 44 : 72,
            borderRadius: 10,
            border: `1px solid ${accent}22`,
            background: "rgba(9, 9, 9, 0.96)",
            color: "#7a7a7a",
            fontFamily: "monospace",
            fontSize: compact ? 10 : 11,
            padding: compact ? "8px 10px" : 10,
            lineHeight: 1.35,
            boxShadow: `0 0 0 1px ${accent}08 inset`,
            flexShrink: 0,
          }}
        >
          Speak text is sourced upstream. The player only performs it.
          {upstreamStatusInside}
        </div>
      )}

      {!(compact && !showTextInput) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: compact ? 10 : 11, color: "#ccc" }}>
            <div style={{ flex: "1 1 100%", color: "#8a8a8a", fontSize: compact ? 10 : 11 }}>
              Voice status: {status} {speaking ? "(active)" : ""}
            </div>
            {windowsFallbackHint}
            {neuralFailurePanel}
          </div>
        </div>
      ) : null}

      {compact ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "center",
            flexShrink: 0,
            paddingBottom: 14,
            marginTop: "auto",
          }}
        >
          <div
            style={{ touchAction: "none" }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Knob
              label="Volume"
              unit="%"
              min={0}
              max={100}
              step={1}
              value={volume}
              onValueChange={setVolume}
              wheelMultiplier={1.5}
              dragMultiplier={2}
              size="sm"
              theme="dark"
              showReadout
              showLabel
              className="shrink-0 w-16"
            />
          </div>
          <AsciiStartStopButton
            running={speaking || paused}
            disabled={!text.trim() || status === "loading"}
            onRunningChange={(nextRunning) => {
              if (nextRunning) {
                void speak();
                return;
              }
              stop();
            }}
            ariaLabelOn="Codex voice on, press to stop"
            ariaLabelOff="Codex voice off, press to start"
            style={{
              alignSelf: "center",
              marginTop: 4,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
