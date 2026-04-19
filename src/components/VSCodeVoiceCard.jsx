import MemoryMomentCard from "./MemoryMomentCard";
import AsciiStartStopButton from "./AsciiStartStopButton";
import VoiceAdaptiveWheel from "./VoiceAdaptiveWheel";
import { CURSOR_TTS_PROFILES, DEFAULT_VSCODE_TTS_PROFILE_ID } from "../lib/cursorTtsProfiles";
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
          <VoiceAdaptiveWheel
            value={selectedProfile}
            onValueChange={onProfileChange ?? (() => {})}
            options={CURSOR_TTS_PROFILES.map((p) => ({ value: p.id, label: p.label }))}
            bezelTitle="VS Code"
            fullWidth
            accent={accent}
          />
          <div
            style={{
              color: "#a8a8a8",
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
              fontSize: 8,
              lineHeight: 1.45,
              wordBreak: "break-word",
              textAlign: "left",
              width: "100%",
              alignSelf: "stretch",
            }}
          >
            {String(resolved?.description || "").trim() || "No short description for this profile."}
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
