import MemoryMomentCard from "./MemoryMomentCard";
import AsciiStartStopButton from "./AsciiStartStopButton";
import { DEFAULT_VSCODE_TTS_PROFILE_ID } from "../lib/cursorTtsProfiles";
import { resolveVoiceProfile } from "../lib/voiceProfiles";

import { useMemo, useState } from "react";

export default function VSCodeVoiceCard({
  selectedProfile = DEFAULT_VSCODE_TTS_PROFILE_ID,
  onProfileChange,
  onStart,
  onStop,
  accent = "#78b8ff",
  ...props
}) {
  const [running, setRunning] = useState(false);

  const resolved = useMemo(() => {
    try {
      return resolveVoiceProfile(selectedProfile);
    } catch {
      return null;
    }
  }, [selectedProfile]);

  const handleToggle = () => {
    if (running) {
      setRunning(false);
      onStop && onStop();
    } else {
      setRunning(true);
      onStart && onStart();
    }
  };

  return (
    <MemoryMomentCard
      title="VS Code"
      accent={accent}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        boxSizing: "border-box",
        padding: 0,
      }}
      {...props}
    >
      {/* Drag handle moved to grid item parent in VoiceFlowPanel */}
      <div
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
          minWidth: 0,
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          overflow: "hidden",
          padding: "6px 8px 72px",
        }}
      >
        <div
          style={{
            width: "100%",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            minHeight: 0,
            gap: 8,
          }}
        >
          <div
            style={{
              width: "100%",
              borderRadius: 14,
              border: `1px solid ${accent}2a`,
              background: "linear-gradient(180deg, rgba(10,12,16,0.96), rgba(4,5,8,0.98))",
              boxShadow: `0 0 0 1px ${accent}12 inset`,
              padding: "12px 14px 10px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "baseline",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  color: accent,
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {resolved?.label || "VS Code"}
              </div>
              <div style={{ color: "#7a7a7a", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Voice locked
              </div>
            </div>
            <div
              style={{
                color: "#a8a8a8",
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
                fontSize: 8,
                lineHeight: 1.45,
                wordBreak: "break-word",
                textAlign: "left",
                width: "100%",
              }}
            >
              {String(resolved?.description || "").trim() || "This voice is fixed to VS Code."}
            </div>
          </div>
          <div
            style={{
              width: "100%",
              color: "#8a8a8a",
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              textAlign: "center",
              paddingTop: 2,
            }}
          >
            Voice status: {running ? "active" : "idle"}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 10,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "auto",
          }}
        >
          <AsciiStartStopButton
            running={running}
            disabled={false}
            onRunningChange={handleToggle}
            ariaLabelOn="VS Code voice on, press to stop"
            ariaLabelOff="VS Code voice off, press to start"
          />
        </div>
      </div>
    </MemoryMomentCard>
  );
}
