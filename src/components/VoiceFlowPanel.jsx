import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactGridLayout, { useContainerWidth } from "react-grid-layout";
import { noCompactor } from "react-grid-layout/core";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import VoiceCard from "./VoiceCard";
import VSCodeVoiceCard from "./VSCodeVoiceCard";
import { Knob } from "./ui/knob";
import {
  clampCursorTtsVolumeUi,
  CURSOR_TTS_VOLUME_UI_DEFAULT,
  CURSOR_TTS_VOLUME_UI_MAX,
  CURSOR_TTS_VOLUME_UI_MIN,
} from "../lib/cursorTtsVolume";
import { resolveVoiceProfile } from "../lib/voiceProfiles";
import {
  DEFAULT_CURSOR_TTS_PROFILE_ID,
  DEFAULT_CODEX_TTS_PROFILE_ID,
  DEFAULT_VSCODE_TTS_PROFILE_ID,
} from "../lib/cursorTtsProfiles";

const VOICE_GRID_COLS = 12;
const VOICE_GRID_MARGIN_X = 12;
const VOICE_GRID_MARGIN_Y = 12;
const VOICE_GRID_ROW_HEIGHT = 24;

const VOICE_GRID_LAYOUT_STORAGE_KEY = "wyc_voice_grid_layout_v1";
const VSCODE_VOICE_PROFILE_STORAGE_KEY = "wyc_vscode_voice_profile_v1";

const DEFAULT_VOICE_GRID_LAYOUT = [
  {
    i: "cursor",
    x: 0,
    y: 0,
    w: 4,
    h: 6,
    minW: 2,
    minH: 4,
    resizeHandles: ["e", "s", "se"],
    isResizable: true,
    isDraggable: true,
  },
  {
    i: "vscode",
    x: 4,
    y: 0,
    w: 4,
    h: 6,
    minW: 1,
    minH: 2,
    resizeHandles: ["e", "s", "se"],
    isResizable: true,
    isDraggable: true,
  },
  {
    i: "codex",
    x: 8,
    y: 0,
    w: 4,
    h: 6,
    minW: 1,
    minH: 2,
    resizeHandles: ["e", "s", "se"],
    isResizable: true,
    isDraggable: true,
  },
];

function loadPersistedVoiceGridLayout() {
  if (typeof window === "undefined") {
    return DEFAULT_VOICE_GRID_LAYOUT.map((x) => ({ ...x }));
  }
  try {
    const raw = window.localStorage.getItem(VOICE_GRID_LAYOUT_STORAGE_KEY);
    if (!raw) return DEFAULT_VOICE_GRID_LAYOUT.map((x) => ({ ...x }));
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_VOICE_GRID_LAYOUT.map((x) => ({ ...x }));
    const byId = new Map(
      parsed
        .filter((entry) => entry && typeof entry === "object" && typeof entry.i === "string")
        .map((entry) => [entry.i, entry]),
    );
    return DEFAULT_VOICE_GRID_LAYOUT.map((fb) => {
      const stored = byId.get(fb.i);
      if (!stored) return { ...fb };
      const num = (key, fallback, min, max) => {
        const v = Number(stored[key]);
        if (!Number.isFinite(v)) return fallback;
        return Math.max(min, Math.min(max, Math.round(v)));
      };
      const minW = fb.minW ?? 1;
      const minH = fb.minH ?? 1;
      let w = num("w", fb.w, minW, VOICE_GRID_COLS);
      let h = num("h", fb.h, minH, 60);
      let x = num("x", fb.x, 0, VOICE_GRID_COLS - 1);
      let y = num("y", fb.y, 0, 80);
      x = Math.max(0, Math.min(x, Math.max(0, VOICE_GRID_COLS - w)));
      return { ...fb, x, y, w, h };
    });
  } catch {
    return DEFAULT_VOICE_GRID_LAYOUT.map((x) => ({ ...x }));
  }
}

function PipelineShell({
  title,
  accent,
  subtitle,
  children,
  gridW,
  gridH,
  showTitleRow = true,
  /** No outer frame — children provide the visible card; use for inline drag on inner chrome. */
  bare = false,
  style = {},
}) {
  const rootRef = useRef(null);
  const [pxSize, setPxSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      setPxSize({ w: Math.round(el.offsetWidth), h: Math.round(el.offsetHeight) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasGrid = gridW != null && gridH != null;
  const titleLine =
    hasGrid && pxSize.w > 0 && pxSize.h > 0
      ? `${title} · ${pxSize.w}×${pxSize.h}px (${gridW} cols × ${gridH} rows)`
      : hasGrid
        ? `${title} · ${gridW} cols × ${gridH} rows`
        : title;

  const showFloatingStrip = !bare && !showTitleRow;

  return (
    <div
      ref={rootRef}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        minHeight: 0,
        width: "100%",
        gap: showTitleRow ? 10 : 0,
        ...(bare
          ? {
              overflow: showTitleRow ? "visible" : "hidden",
            }
          : {
              borderRadius: 18,
              border: `1px solid ${accent}33`,
              background: "linear-gradient(180deg, rgba(8,8,8,0.98), rgba(4,4,4,0.98))",
              boxShadow: `0 0 0 1px ${accent}12 inset`,
              padding: 12,
              overflow: "auto",
            }),
        ...style,
      }}
    >
      {showTitleRow ? (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div
            className="voice-card-handle"
            style={{
              cursor: "move",
              color: accent,
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              userSelect: "none",
            }}
          >
            {titleLine}
          </div>
          {subtitle ? <div style={{ color: "#7a7a7a", fontSize: 10 }}>{subtitle}</div> : null}
        </div>
      ) : showFloatingStrip ? (
        <div
          className="voice-card-handle"
          aria-label={title}
          title={title}
          style={{
            position: "absolute",
            top: 8,
            left: 10,
            right: 10,
            height: 12,
            zIndex: 2,
            cursor: "move",
            borderRadius: 6,
            background: `linear-gradient(90deg, transparent, ${accent}22, transparent)`,
            opacity: 0.55,
          }}
        />
      ) : null}
      {children}
    </div>
  );
}

const MECHANICUS_CURSOR_BRIDGE = "/__cyberdeck/mechanicus-cursor";

function RealmorphPowerLamp({ enabled, disabled, style }) {
  return (
    <div
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        margin: 0,
        borderRadius: 999,
        border: enabled ? "1px solid rgba(57, 255, 20, 0.34)" : "1px solid rgba(201, 162, 39, 0.28)",
        background: enabled
          ? "linear-gradient(180deg, rgba(12, 20, 7, 0.96), rgba(5, 8, 3, 0.99))"
          : "linear-gradient(180deg, rgba(24, 18, 8, 0.96), rgba(8, 6, 2, 0.99))",
        boxShadow:
          "0 0 0 1px rgba(255, 255, 255, 0.03) inset, 0 12px 24px rgba(0, 0, 0, 0.25)",
        color: enabled ? "#b3ff95" : "#d7be6a",
        fontFamily:
          '"Cascadia Mono", "Cascadia Code", Consolas, "Liberation Mono", "Courier New", ui-monospace, monospace',
        fontSize: 8,
        lineHeight: 1,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        cursor: "default",
        userSelect: "none",
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      <span>Realmorph Shim</span>
      <span
        style={{
          position: "relative",
          flexShrink: 0,
          width: 54,
          height: 22,
          borderRadius: 999,
          border: enabled ? "1px solid rgba(57, 255, 20, 0.24)" : "1px solid rgba(201, 162, 39, 0.2)",
          background: enabled
            ? "linear-gradient(180deg, rgba(57, 255, 20, 0.18), rgba(57, 255, 20, 0.06))"
            : "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
          boxShadow:
            "inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 rgba(0, 0, 0, 0.35)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: enabled ? 30 : 2,
            width: 18,
            height: 18,
            borderRadius: 999,
            border: enabled ? "1px solid rgba(57, 255, 20, 0.35)" : "1px solid rgba(201, 162, 39, 0.28)",
            background: enabled
              ? "radial-gradient(circle at 35% 35%, rgba(220, 255, 204, 0.98), rgba(125, 255, 90, 0.92) 68%, rgba(57, 255, 20, 0.92) 100%)"
              : "radial-gradient(circle at 35% 35%, rgba(250, 238, 198, 0.98), rgba(201, 162, 39, 0.9) 72%, rgba(122, 92, 18, 0.92) 100%)",
            boxShadow: enabled
              ? "0 0 10px rgba(57, 255, 20, 0.22), 0 2px 8px rgba(0, 0, 0, 0.35)"
              : "0 0 10px rgba(201, 162, 39, 0.18), 0 2px 8px rgba(0, 0, 0, 0.35)",
            transition: "left 120ms ease, background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
          }}
        />
        <span
          style={{
            position: "absolute",
            right: 7,
            top: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            color: enabled ? "#9cff76" : "#8f8f8f",
            fontSize: 7,
            letterSpacing: "0.18em",
          }}
        >
          {enabled ? "ON" : "OFF"}
        </span>
      </span>
    </div>
  );
}

function MechanicusCursorStage({ gridW, gridH }) {
  const accent = "#c9a227";
  const [muted, setMuted] = useState(false);
  const [hookVolume, setHookVolume] = useState(CURSOR_TTS_VOLUME_UI_DEFAULT);
  const [profile, setProfile] = useState(DEFAULT_CURSOR_TTS_PROFILE_ID);
  const [bridge, setBridge] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [voiceListNonce, setVoiceListNonce] = useState(0);
  const normalizeProfileId = (value) => String(value || "").replace(/(?:-copy)+$/i, "");
  const effectiveProfile = normalizeProfileId(profile);

  const hookOn = !muted;

  const cursorVoiceResolved = useMemo(() => {
    try {
      return resolveVoiceProfile(effectiveProfile);
    } catch {
      return null;
    }
  }, [effectiveProfile]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(MECHANICUS_CURSOR_BRIDGE, { method: "GET" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setMuted(!!j.muted);
      if (typeof j.profile === "string" && j.profile) setProfile(normalizeProfileId(j.profile));
      if (typeof j.volume === "number" && Number.isFinite(j.volume)) {
        setHookVolume(clampCursorTtsVolumeUi(j.volume));
      }
      setBridge(!!j.bridge);
      setErr(null);
      return j;
    } catch {
      setBridge(false);
      setErr(null);
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** GET then POST same state — light bump for wheel / profile-only writes. */
  const resyncHookFiles = useCallback(
    async (profileId) => {
      try {
        const j = await refresh();
        if (!j?.bridge) return;
        const pid = normalizeProfileId(profileId);
        const r2 = await fetch(MECHANICUS_CURSOR_BRIDGE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            muted: !!j.muted,
            profile: pid,
            volume:
              typeof j.volume === "number" && Number.isFinite(j.volume)
                ? clampCursorTtsVolumeUi(j.volume)
                : CURSOR_TTS_VOLUME_UI_DEFAULT,
          }),
        });
        if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
        const j2 = await r2.json();
        setMuted(!!j2.muted);
        if (typeof j2.profile === "string" && j2.profile) setProfile(normalizeProfileId(j2.profile));
        if (typeof j2.volume === "number" && Number.isFinite(j2.volume)) {
          setHookVolume(clampCursorTtsVolumeUi(j2.volume));
        }
        setBridge(true);
        setVoiceListNonce((n) => n + 1);
      } catch (e) {
        setErr(String(e?.message || e));
      }
    },
    [refresh],
  );

  /** Force mute on, brief pause, restore prior mute — power-cycle for START/STOP recovery. */
  const muteCycleRecover = useCallback(
    async (profileId) => {
      try {
        const j = await refresh();
        if (!j?.bridge) return;
        const pid = normalizeProfileId(profileId);
        const savedMuted = !!j.muted;

        const postJson = async (body) => {
          const r = await fetch(MECHANICUS_CURSOR_BRIDGE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        };

        const vol =
          typeof j.volume === "number" && Number.isFinite(j.volume)
            ? clampCursorTtsVolumeUi(j.volume)
            : CURSOR_TTS_VOLUME_UI_DEFAULT;
        await postJson({ muted: true, profile: pid, volume: vol });
        setMuted(true);
        await new Promise((r) => setTimeout(r, 140));

        const j2 = await postJson({ muted: savedMuted, profile: pid, volume: vol });
        setMuted(!!j2.muted);
        if (typeof j2.profile === "string" && j2.profile) setProfile(normalizeProfileId(j2.profile));
        if (typeof j2.volume === "number" && Number.isFinite(j2.volume)) {
          setHookVolume(clampCursorTtsVolumeUi(j2.volume));
        }
        setBridge(true);
        await refresh();
      } catch (e) {
        setErr(String(e?.message || e));
      }
    },
    [refresh],
  );

  const postState = async (patch = {}) => {
    const volumeOnly =
      Object.keys(patch).length === 1 && "volume" in patch && !("muted" in patch) && !("profile" in patch);
    if (!volumeOnly) {
      setBusy(true);
    }
    setErr(null);
    try {
      const nextMuted = "muted" in patch ? patch.muted : muted;
      const nextProfile = normalizeProfileId("profile" in patch ? patch.profile : effectiveProfile);
      const nextVol =
        "volume" in patch && typeof patch.volume === "number" && Number.isFinite(patch.volume)
          ? clampCursorTtsVolumeUi(patch.volume)
          : hookVolume;
      const r = await fetch(MECHANICUS_CURSOR_BRIDGE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          muted: nextMuted,
          profile: nextProfile,
          volume: clampCursorTtsVolumeUi(nextVol),
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setMuted(!!j.muted);
      if (typeof j.profile === "string" && j.profile) setProfile(normalizeProfileId(j.profile));
      if (typeof j.volume === "number" && Number.isFinite(j.volume)) {
        setHookVolume(clampCursorTtsVolumeUi(j.volume));
      }
      setBridge(true);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      if (!volumeOnly) {
        setBusy(false);
      }
    }
  };

  const setHookEnabled = (on) => {
    const pid = normalizeProfileId(effectiveProfile);
    void (async () => {
      await postState({ muted: !on, profile: pid });
      await muteCycleRecover(pid);
    })();
  };

  const setHookVolumeFromUi = (next) => {
    const v = clampCursorTtsVolumeUi(next);
    setHookVolume(v);
    void postState({ volume: v });
  };

  return (
    <PipelineShell
      bare
      title="CURSOR · AFTER-REPLY"
      gridW={gridW}
      gridH={gridH}
      accent={accent}
      showTitleRow={false}
      style={{
        flex: 1,
        minHeight: 0,
        height: "100%",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          width: "100%",
          borderRadius: 12,
          border: "1px solid #2a2410",
          background: "#080703",
          color: "#c7c7c7",
          fontSize: 10,
          overflow: "hidden",
        }}
      >
        <div
          className="voice-card-handle"
          aria-label="CURSOR · AFTER-REPLY"
          title={bridge ? "dev bridge" : "static / prod"}
          style={{
            flexShrink: 0,
            height: 10,
            cursor: "move",
            borderRadius: "6px 6px 0 0",
            background: `linear-gradient(90deg, transparent, ${accent}22, transparent)`,
            opacity: 0.55,
            userSelect: "none",
          }}
        />
        <div
          style={{
            position: "relative",
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "6px 6px 104px",
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            lineHeight: 1.4,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 6,
              zIndex: 40,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 6,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                pointerEvents: "auto",
                display: "flex",
                alignItems: "flex-end",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 7,
                  padding: "10px 12px 9px",
                  borderRadius: 18,
                  border: "1px solid rgba(201, 162, 39, 0.22)",
                  background:
                    "linear-gradient(180deg, rgba(14, 10, 4, 0.94), rgba(5, 4, 2, 0.98))",
                  boxShadow:
                    "0 0 0 1px rgba(255, 255, 255, 0.03) inset, 0 16px 36px rgba(0, 0, 0, 0.34), 0 0 24px rgba(201, 162, 39, 0.08)",
                }}
              >
                <div
                  style={{
                    touchAction: "none",
                    transform: "scale(0.66)",
                    transformOrigin: "50% 100%",
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  title={`Level ${hookVolume}% · click dial to arm / disarm`}
                >
                  <Knob
                    label="Level"
                    unit="%"
                    min={CURSOR_TTS_VOLUME_UI_MIN}
                    max={CURSOR_TTS_VOLUME_UI_MAX}
                    step={1}
                    value={hookVolume}
                    onValueChange={setHookVolumeFromUi}
                    active={hookOn}
                    clickTogglesActive
                    onActiveChange={setHookEnabled}
                    wheelMultiplier={0.6}
                    dragMultiplier={1.2}
                    size="sm"
                    theme="dark"
                    showReadout={false}
                    showLabel={false}
                    disabled={busy || !bridge}
                    className="w-16 shrink-0"
                  />
                </div>
              <RealmorphPowerLamp
                enabled={hookOn}
                disabled={busy || !bridge}
              />
            </div>
          </div>
            <div
              style={{
                height: 1,
                width: "100%",
                maxWidth: 238,
                background:
                  "linear-gradient(90deg, transparent, rgba(201, 162, 39, 0.22), rgba(57, 255, 20, 0.16), transparent)",
              }}
            />
          </div>

          <div
            style={{
              flex: "0 0 auto",
              width: "100%",
              minWidth: 0,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              justifyContent: "flex-start",
              padding: "0 8px 0 8px",
              overflow: "visible",
            }}
          >
            <div
              style={{
                width: "100%",
                display: "grid",
                gap: 6,
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(201, 162, 39, 0.22)",
                background: "rgba(10, 8, 3, 0.92)",
                boxShadow: "0 0 0 1px rgba(201, 162, 39, 0.08) inset",
              }}
            >
              <div style={{ color: "#7a7a7a", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Fixed voice
              </div>
              <div style={{ color: "#f7e6b0", fontFamily: "monospace", fontSize: 14 }}>
                {cursorVoiceResolved?.label || "Tech Priest"}
              </div>
              <div style={{ color: "#a8a8a8", fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: 8, lineHeight: 1.45 }}>
                {String(cursorVoiceResolved?.description || "").trim() || "This AI uses one locked voice profile."}
              </div>
            </div>
          </div>

          <div
            style={{
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {!bridge ? (
              <div style={{ color: "#6a6a6a", fontSize: 7, lineHeight: 1.35 }}>
                Run pnpm dev (or preview) so the bridge can write .cursor/hooks/ — or edit mechanicus-cursor.muted,
                cursor-tts-voice.txt, and cursor-tts-volume.txt (0–100, 100 = default) by hand.
              </div>
            ) : null}
            <div
              style={{
                color: "#a8a8a8",
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
                fontSize: 8,
                lineHeight: 1.45,
                wordBreak: "break-word",
                opacity: bridge ? 1 : 0.55,
              }}
            >
              {String(cursorVoiceResolved?.description || "").trim() ||
                "No short description for this profile."}
            </div>
            <div
              style={{
                marginTop: 8,
                fontFamily: '"Cascadia Mono", ui-monospace, monospace',
                fontSize: 7,
                lineHeight: 1.4,
                letterSpacing: "0.04em",
                color: "rgba(155, 255, 155, 0.28)",
                wordBreak: "break-word",
              }}
            >
              {
                "// relay: codex read the manifest aloud like a briefing — cursor=warp spider, vscode=tech priest, codex=scribe already matches cursorTtsProfiles.js; nothing was broken, only re-narrated. he still scripts how you feel about it. bus nominal."
              }
            </div>
          </div>

          {err ? (
            <div style={{ color: "#ff8a8a", fontSize: 9, flexShrink: 0 }}>{err}</div>
          ) : null}
        </div>
      </div>
    </PipelineShell>
  );
}

/** VS Code agent voice: poll dev bridge without `window` globals; abort in-flight fetch on stop/unmount. */
const VSCODE_VOICE_POLL_MS = 3500;

function useVscodeAgentVoicePoller(profileId) {
  const intervalRef = useRef(null);
  const lastUrlRef = useRef("");
  const abortRef = useRef(null);
  const profileRef = useRef(profileId);
  profileRef.current = profileId;

  const stop = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    lastUrlRef.current = "";
  }, []);

  const tick = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const pid = String(profileRef.current || "").trim() || DEFAULT_VSCODE_TTS_PROFILE_ID;
    try {
      const res = await fetch("/__cyberdeck/vscode-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muted: false, profile: pid }),
        signal: ac.signal,
      });
      if (!res.ok) return;
      const data = await res.json();
      const url = data?.audioUrl;
      if (typeof url !== "string" || !url || url === lastUrlRef.current) return;
      const audio = new Audio(url);
      await audio.play();
      lastUrlRef.current = url;
    } catch (e) {
      if (e?.name === "AbortError") return;
    }
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current != null) return;
    void tick();
    intervalRef.current = window.setInterval(() => {
      void tick();
    }, VSCODE_VOICE_POLL_MS);
  }, [tick]);

  useEffect(() => () => stop(), [stop]);

  return { start, stop };
}

function loadPersistedVscodeVoiceProfileId() {
  if (typeof window === "undefined") return DEFAULT_VSCODE_TTS_PROFILE_ID;
  try {
    const raw = window.localStorage.getItem(VSCODE_VOICE_PROFILE_STORAGE_KEY);
    const id = String(raw || "").trim();
    if (id) return id;
  } catch {
    /* private mode */
  }
  return DEFAULT_VSCODE_TTS_PROFILE_ID;
}

function VoiceFlowPanel({ compact = false } = {}) {
  const [vscodeProfileId, setVscodeProfileId] = useState(loadPersistedVscodeVoiceProfileId);
  const vscodeVoicePoller = useVscodeAgentVoicePoller(vscodeProfileId);

  const [voiceGridLayout, setVoiceGridLayout] = useState(() => loadPersistedVoiceGridLayout());

  useEffect(() => {
    try {
      window.localStorage.setItem(VOICE_GRID_LAYOUT_STORAGE_KEY, JSON.stringify(voiceGridLayout));
    } catch {
      /* quota / private mode */
    }
  }, [voiceGridLayout]);

  useEffect(() => {
    try {
      window.localStorage.setItem(VSCODE_VOICE_PROFILE_STORAGE_KEY, vscodeProfileId);
    } catch {
      /* quota / private mode */
    }
  }, [vscodeProfileId]);

  const cursorGridItem = useMemo(() => voiceGridLayout.find((item) => item.i === "cursor"), [voiceGridLayout]);
  const cursorGridW = cursorGridItem?.w ?? 4;
  const cursorGridH = cursorGridItem?.h ?? 6;
  const vscodeGridItem = useMemo(() => voiceGridLayout.find((item) => item.i === "vscode"), [voiceGridLayout]);
  const vscodeGridW = vscodeGridItem?.w ?? 4;
  const vscodeGridH = vscodeGridItem?.h ?? 6;
  const codexGridItem = useMemo(() => voiceGridLayout.find((item) => item.i === "codex"), [voiceGridLayout]);
  const codexGridW = codexGridItem?.w ?? 4;
  const codexGridH = codexGridItem?.h ?? 6;

  const handleVoiceGridLayoutChange = (nextLayout) => {
    setVoiceGridLayout(nextLayout);
  };

  return (
    <div
      style={{
        width: "100%",
        minHeight: compact ? "min(720px, calc(100dvh - 170px))" : "min(820px, calc(100dvh - 130px))",
        height: compact ? "min(720px, calc(100dvh - 170px))" : "min(820px, calc(100dvh - 130px))",
        borderRadius: 20,
        border: "1px solid rgba(0,255,102,0.18)",
        overflow: "visible",
        background: "rgba(0,0,0,0.96)",
      }}
    >
      <div
        style={{
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          color: "#7a7a7a",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span>Cursor</span>
        <span>VS Code</span>
        <span>Codex</span>
      </div>

      <div
        style={{
          height: "calc(100% - 40px)",
          overflowY: "auto",
          overflowX: "visible",
          padding: "10px 12px 24px 12px",
        }}
      >
        <div style={{ minHeight: 0 }}>
          <VoiceGrid layout={voiceGridLayout} onLayoutChange={handleVoiceGridLayoutChange}>
            <div key="cursor" style={{ minHeight: 0, height: "100%" }}>
              <MechanicusCursorStage gridW={cursorGridW} gridH={cursorGridH} />
            </div>
            <div
              key="vscode"
              style={{
                minHeight: 0,
                height: "100%",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                padding: 0,
              }}
            >
              <div
                className="voice-card-handle"
                style={{
                  flexShrink: 0,
                  height: 10,
                  cursor: "move",
                  borderRadius: "6px 6px 0 0",
                  background: "linear-gradient(90deg, transparent, #78b8ff22, transparent)",
                  opacity: 0.55,
                  userSelect: "none",
                  marginBottom: 2,
                  zIndex: 2,
                }}
                aria-label="VS Code drag handle"
                title="Drag to move"
              />
              <VSCodeVoiceCard
                selectedProfile={vscodeProfileId}
                onProfileChange={setVscodeProfileId}
                isContinuous
                onStart={vscodeVoicePoller.start}
                onStop={vscodeVoicePoller.stop}
                accent="#78b8ff"
                style={{ marginTop: 0, height: "100%", width: "100%" }}
              />
            </div>
            <div key="codex" style={{ minHeight: 0, height: "100%", position: "relative", display: "flex", flexDirection: "column", padding: 0 }}>
              <div
                className="voice-card-handle"
                style={{
                  flexShrink: 0,
                  height: 10,
                  cursor: "move",
                  borderRadius: "6px 6px 0 0",
                  background: "linear-gradient(90deg, transparent, rgba(155,255,155,0.14), transparent)",
                  opacity: 0.55,
                  userSelect: "none",
                  marginBottom: 2,
                  zIndex: 2,
                }}
                aria-label="Codex drag handle"
                title="Drag to move"
              />
              <VoiceCard
                compact
                title="CODEX"
                accent="#9bff9b"
                defaultProfile={DEFAULT_CODEX_TTS_PROFILE_ID}
                sampleText="Codex online. Drop the next prompt here."
                showTextInput={false}
                style={{ marginTop: 0, height: "100%", width: "100%" }}
              />
            </div>
          </VoiceGrid>
        </div>
      </div>
    </div>
  );
}

function VoiceGrid({ layout, onLayoutChange, children }) {
  const { width, containerRef, mounted } = useContainerWidth();
  const accent = "rgba(127,215,255,0.9)";

  const handleLayoutChange = (nextLayout) => {
    onLayoutChange?.(nextLayout);
  };

  const resizeHandle = (axis, ref) => {
    const base = { position: "absolute", pointerEvents: "auto", opacity: 0.95, zIndex: 2, boxSizing: "border-box" };
    if (axis === "e") {
      return (
        <div
          ref={ref}
          aria-hidden="true"
          style={{
            ...base,
            right: 0,
            top: 0,
            bottom: 0,
            width: 10,
            cursor: "ew-resize",
            borderRight: `2px solid ${accent}`,
            background: "linear-gradient(90deg, transparent, rgba(127,215,255,0.08))",
          }}
        />
      );
    }
    if (axis === "s") {
      return (
        <div
          ref={ref}
          aria-hidden="true"
          style={{
            ...base,
            left: 0,
            right: 0,
            bottom: 0,
            height: 10,
            cursor: "ns-resize",
            borderBottom: `2px solid ${accent}`,
            background: "linear-gradient(180deg, transparent, rgba(127,215,255,0.08))",
          }}
        />
      );
    }
    return (
      <div
        ref={ref}
        aria-hidden="true"
        style={{
          ...base,
          right: 0,
          bottom: 0,
          width: 18,
          height: 18,
          borderRight: `2px solid ${accent}`,
          borderBottom: `2px solid ${accent}`,
          borderRadius: "0 0 4px 0",
          background:
            "linear-gradient(135deg, transparent 42%, rgba(127,215,255,0.18) 43%, rgba(127,215,255,0.18) 57%, transparent 58%)",
          cursor: "se-resize",
        }}
      />
    );
  };

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      {mounted ? (
        <ReactGridLayout
          width={width}
          layout={layout}
          onLayoutChange={handleLayoutChange}
          gridConfig={{
            cols: VOICE_GRID_COLS,
            rowHeight: VOICE_GRID_ROW_HEIGHT,
            margin: [VOICE_GRID_MARGIN_X, VOICE_GRID_MARGIN_Y],
            containerPadding: [0, 0],
          }}
          dragConfig={{ enabled: true, handle: ".voice-card-handle" }}
          resizeConfig={{ enabled: true, handles: ["e", "s", "se"], handleComponent: resizeHandle }}
          compactor={noCompactor}
          style={{ width: "100%" }}
        >
          {children}
        </ReactGridLayout>
      ) : null}
    </div>
  );
}

export default VoiceFlowPanel;
