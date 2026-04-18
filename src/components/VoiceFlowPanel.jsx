import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactGridLayout, { useContainerWidth } from "react-grid-layout";
import { noCompactor } from "react-grid-layout/core";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import VoiceAdaptiveWheel from "./VoiceAdaptiveWheel";
import { getAllVoiceProfiles, resolveVoiceProfile, saveVoiceProfilePreset } from "../lib/voiceProfiles";
import { DEFAULT_CURSOR_TTS_PROFILE_ID } from "../lib/cursorTtsProfiles";

const DEFAULT_PRESET_NAME = "mechanicus";

function PipelineShell({ title, accent, subtitle, children, gridW, gridH, style = {} }) {
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

  return (
    <div
      ref={rootRef}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        borderRadius: 18,
        border: `1px solid ${accent}33`,
        background: "linear-gradient(180deg, rgba(8,8,8,0.98), rgba(4,4,4,0.98))",
        boxShadow: `0 0 0 1px ${accent}12 inset`,
        padding: 12,
        overflow: "auto",
        ...style,
      }}
    >
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
        <div style={{ color: "#7a7a7a", fontSize: 10 }}>{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

const MECHANICUS_CURSOR_BRIDGE = "/__cyberdeck/mechanicus-cursor";

function MechanicusCursorStage({ gridW, gridH }) {
  const accent = "#c9a227";
  const [muted, setMuted] = useState(false);
  const [profile, setProfile] = useState(DEFAULT_CURSOR_TTS_PROFILE_ID);
  const [bridge, setBridge] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [voiceListNonce, setVoiceListNonce] = useState(0);

  const cursorWheelOptions = useMemo(() => {
    const seen = new Map();
    for (const p of getAllVoiceProfiles()) {
      if (p?.id && !seen.has(p.id)) {
        seen.set(p.id, {
          id: p.id,
          label: p.label || p.id,
          description: p.description || "",
        });
      }
    }
    const arr = [...seen.values()].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
    if (profile && !seen.has(profile)) {
      arr.push({ id: profile, label: profile, description: "(from hook file)" });
    }
    return arr.map((o) => ({
      label: o.label,
      value: o.id,
      textValue: `${o.label} ${o.description} ${o.id}`,
    }));
  }, [profile, voiceListNonce]);

  const hookOn = !muted;

  const refresh = async () => {
    try {
      const r = await fetch(MECHANICUS_CURSOR_BRIDGE, { method: "GET" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setMuted(!!j.muted);
      if (typeof j.profile === "string" && j.profile) setProfile(j.profile);
      setBridge(!!j.bridge);
      setErr(null);
      setVoiceListNonce((n) => n + 1);
    } catch {
      setBridge(false);
      setErr(null);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const postState = async (patch) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(MECHANICUS_CURSOR_BRIDGE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setMuted(!!j.muted);
      if (typeof j.profile === "string" && j.profile) setProfile(j.profile);
      setBridge(true);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const setHookEnabled = (on) => {
    void postState({ muted: !on });
  };

  const setVoiceProfile = (id) => {
    void postState({ profile: id });
  };

  return (
    <PipelineShell
      title="CURSOR · AFTER-REPLY"
      gridW={gridW}
      gridH={gridH}
      accent={accent}
      subtitle={bridge ? "dev bridge" : "static / prod"}
      style={{
        minHeight: 0,
        height: "100%",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflow: "visible",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 6,
          overflow: "visible",
          borderRadius: 12,
          border: "1px solid #2a2410",
          background: "#080703",
          color: "#c7c7c7",
          fontSize: 10,
          lineHeight: 1.4,
          width: "100%",
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "4px 2px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          <div style={{ color: accent, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 9 }}>
            Cursor TTS
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                letterSpacing: "0.14em",
                color: hookOn ? "#6dff9a" : "#ff8a4a",
              }}
            >
              {hookOn ? "ON" : "OFF"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={hookOn}
              aria-label={hookOn ? "Cursor after-reply TTS on" : "Cursor after-reply TTS off"}
              disabled={busy || !bridge}
              onClick={() => setHookEnabled(!hookOn)}
              style={{
                position: "relative",
                width: 52,
                height: 26,
                borderRadius: 13,
                border: `1px solid ${hookOn ? "rgba(109,255,154,0.45)" : "rgba(255,138,74,0.45)"}`,
                background: hookOn ? "rgba(20,48,28,0.95)" : "rgba(48,22,14,0.95)",
                cursor: bridge && !busy ? "pointer" : "not-allowed",
                padding: 0,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: hookOn ? 28 : 3,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: hookOn ? "#6dff9a" : "#ff8a4a",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
                  transition: "left 0.15s ease",
                }}
              />
            </button>
          </div>
        </div>

        <div
          style={{
            flex: "0 1 auto",
            width: "100%",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "6px 0 2px",
          }}
        >
          {cursorWheelOptions.length ? (
            <VoiceAdaptiveWheel
              value={profile}
              onValueChange={(value) => setVoiceProfile(value)}
              options={cursorWheelOptions}
              wrapperClassName="border-0"
              dimmed={busy || !bridge}
              accent={accent}
              maxWidthPx={232}
            />
          ) : null}
        </div>

        <div style={{ color: "#6a6a6a", fontSize: 8, lineHeight: 1.45, flexShrink: 0 }}>
          {!bridge
            ? "Run pnpm dev (or preview) so the bridge can write .cursor/hooks/ — or edit mechanicus-cursor.muted and cursor-tts-voice.txt by hand."
            : "Voice → cursor-tts-voice.txt · ON/OFF → mechanicus-cursor.muted (hook reads these each reply)."}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            style={{
              padding: "6px 10px",
              background: "#0d0d0d",
              color: "#8a8a8a",
              border: "1px solid #2a2a2a",
              borderRadius: 8,
              cursor: !busy ? "pointer" : "not-allowed",
              fontFamily: "monospace",
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Refresh
          </button>
        </div>
        {err ? (
          <div style={{ color: "#ff8a8a", fontSize: 9, flexShrink: 0 }}>{err}</div>
        ) : null}
      </div>
    </PipelineShell>
  );
}

function ProfileStage({ savedProfiles, selectedProfileId, onProfileChange, onCopyProfile, gridW, gridH }) {
  const selectedProfile =
    savedProfiles.find((profile) => profile.id === selectedProfileId) || savedProfiles[0] || null;

  const profileOptions = savedProfiles.map((profile) => ({
    label: profile.label,
    value: profile.id,
    textValue: `${profile.label} ${profile.description} ${profile.id}`,
  }));

  return (
    <PipelineShell
      title="[|[|\/| PROFILE"
      gridW={gridW}
      gridH={gridH}
      accent="#d9b45b"
      subtitle="immutable + wip"
      style={{
        minHeight: 0,
        minWidth: 0,
        height: "100%",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "visible",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto auto",
          overflow: "visible",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 10,
          alignItems: "stretch",
          flex: 1,
          minHeight: 0,
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: 6,
            borderRadius: 12,
            border: "1px solid #222",
            background: "#090909",
            minHeight: 0,
            width: "100%",
            minWidth: 0,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 6, alignItems: "center" }}>
            {profileOptions.length ? (
              <VoiceAdaptiveWheel
                value={selectedProfile?.id || selectedProfileId}
                onValueChange={(value) => onProfileChange(value)}
                options={profileOptions}
                wrapperClassName="border-0"
                dimmed={false}
                accent="#d9b45b"
                maxWidthPx={236}
              />
            ) : (
              <div
                style={{
                  padding: 8,
                  borderRadius: 10,
                  border: "1px dashed #222",
                  color: "#7a7a7a",
                  fontSize: 10,
                  lineHeight: 1.35,
                }}
              >
                No saved profiles yet.
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 4,
            padding: 6,
            borderRadius: 12,
            border: "1px solid #222",
            background: "#070707",
            color: "#c7c7c7",
            fontSize: 9,
            lineHeight: 1.3,
            minHeight: 0,
            width: "100%",
            flexShrink: 0,
          }}
        >
          <div style={{ color: "#d9b45b", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 9 }}>
            Data Sheet
          </div>
          <div style={{ color: "#9bdcff" }}>Selected: {selectedProfile?.label || "None"}</div>
          <div style={{ color: "#7a7a7a" }}>
            {selectedProfile?.description || "Pick a saved voice profile to load."}
          </div>
          <div style={{ color: "#7a7a7a" }}>
            Model: {selectedProfile?.modelMode || "tts"} / {selectedProfile?.language || "en-US"}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => onCopyProfile(selectedProfile?.id || selectedProfileId)}
              disabled={!selectedProfile}
              style={{
                padding: "4px 7px",
                background: selectedProfile ? "#101010" : "#070707",
                color: selectedProfile ? "#a9d0ff" : "#4a4a4a",
                border: `1px solid ${selectedProfile ? "rgba(127,215,255,0.25)" : "#222"}`,
                borderRadius: 8,
                cursor: selectedProfile ? "pointer" : "not-allowed",
                fontFamily: "monospace",
                fontSize: 8,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Copy Immutable
            </button>
          </div>
        </div>
      </div>
    </PipelineShell>
  );
}

export default function VoiceFlowPanel({ defaultProfileId = "jenna-jacket", compact = false } = {}) {
  const [libraryVersion, setLibraryVersion] = useState(0);
  const savedProfiles = useMemo(() => getAllVoiceProfiles(), [libraryVersion]);
  const [selectedProfileId, setSelectedProfileId] = useState(defaultProfileId);
  const [tunedProfile, setTunedProfile] = useState(null);
  const stripCopySuffix = (value) =>
    String(value || "")
      .replace(/(?:\s+copy)+$/i, "")
      .trim();

  const activeProfile = useMemo(
    () => tunedProfile || resolveVoiceProfile(selectedProfileId),
    [selectedProfileId, tunedProfile],
  );

  const [voiceGridLayout, setVoiceGridLayout] = useState(() => [
    {
      i: "profile",
      x: 0,
      y: 0,
      w: 6,
      h: 14,
      minW: 2,
      minH: 12,
      resizeHandles: ["e", "s", "se"],
      isResizable: true,
      isDraggable: true,
    },
    {
      i: "blank",
      x: 6,
      y: 0,
      w: 6,
      h: 14,
      minW: 2,
      minH: 8,
      resizeHandles: ["e", "s", "se"],
      isResizable: true,
      isDraggable: true,
    },
  ]);

  useEffect(() => {
    const next = resolveVoiceProfile(defaultProfileId);
    setSelectedProfileId(next.id);
    setTunedProfile(null);
  }, [defaultProfileId]);

  const handleCopyProfile = (profileId) => {
    const sourceProfile = resolveVoiceProfile(profileId || selectedProfileId);
    const copyLabelBase = stripCopySuffix(sourceProfile.label || DEFAULT_PRESET_NAME);
    const copiedProfile = saveVoiceProfilePreset({
      id: `${sourceProfile.id}-copy`,
      label: `${copyLabelBase} Copy`,
      description: `Immutable copy of ${sourceProfile.label || sourceProfile.id}.`,
      browserVoice: sourceProfile.browserVoice,
      nativeVoice: sourceProfile.nativeVoice,
      forceNativeTTS: sourceProfile.forceNativeTTS,
      modelMode: sourceProfile.modelMode || "tts",
      language: sourceProfile.language || "en-US",
      speakMode: sourceProfile.speakMode || "conversation",
      speakerMode: sourceProfile.speakerMode || "auto",
      rate: sourceProfile.rate,
      pitch: sourceProfile.pitch,
      volume: sourceProfile.volume,
      ttsRate: Number(sourceProfile.ttsRate ?? 0),
      ttsPitch: Number(sourceProfile.ttsPitch ?? 0),
      ttsVolume: Number(sourceProfile.ttsVolume ?? 0),
      effect: sourceProfile.effect || "",
      aliases: sourceProfile.aliases || [],
    });

    setTunedProfile(copiedProfile);
    setSelectedProfileId(copiedProfile.id);
    setLibraryVersion((version) => version + 1);
  };

  const profileGridItem = useMemo(
    () => voiceGridLayout.find((item) => item.i === "profile"),
    [voiceGridLayout],
  );
  const blankGridItem = useMemo(() => voiceGridLayout.find((item) => item.i === "blank"), [voiceGridLayout]);
  const profileGridW = profileGridItem?.w ?? 6;
  const profileGridH = profileGridItem?.h ?? 14;
  const blankGridW = blankGridItem?.w ?? 6;
  const blankGridH = blankGridItem?.h ?? 14;

  return (
    <div
      style={{
        width: "100%",
        minHeight: compact ? 720 : 820,
        height: compact ? 720 : 820,
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
        <span>{"Speak -> Profile -> Model -> Tuner -> Player"}</span>
        <span>{activeProfile?.label || "PROFILE"}</span>
      </div>

      <div
        style={{
          height: "calc(100% - 40px)",
          overflowY: "auto",
          overflowX: "visible",
          padding: "32px 12px 40px 12px",
        }}
      >
        <div style={{ minHeight: 0 }}>
          <VoiceGrid layout={voiceGridLayout} onLayoutChange={setVoiceGridLayout}>
            <div key="profile" style={{ minHeight: 0, height: "100%" }}>
              <ProfileStage
                savedProfiles={savedProfiles}
                selectedProfileId={selectedProfileId}
                onProfileChange={setSelectedProfileId}
                onCopyProfile={handleCopyProfile}
                gridW={profileGridW}
                gridH={profileGridH}
              />
            </div>
            <div key="blank" style={{ minHeight: 0, height: "100%" }}>
              <MechanicusCursorStage gridW={blankGridW} gridH={blankGridH} />
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
          right: 2,
          bottom: 2,
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
          onLayoutChange={onLayoutChange}
          gridConfig={{
            cols: 12,
            rowHeight: 24,
            margin: [12, 12],
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
