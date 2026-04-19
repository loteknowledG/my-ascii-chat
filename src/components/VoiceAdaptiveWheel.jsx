import { WheelPicker, WheelPickerWrapper } from "./wheel-picker";

import { cn } from "@/lib/utils";

/**
 * Single rotary wheel in a bezel. {@link https://github.com/ncdai/react-wheel-picker @ncdai/react-wheel-picker}:
 * {@code visibleCount} must be a multiple of {@code 4}.
 */
export default function VoiceAdaptiveWheel({
  value,
  onValueChange,
  options,
  infinite = true,
  wrapperClassName = "",
  dimmed = false,
  maxWidthPx = 240,
  fullWidth = false,
  visibleCount = 8,
  optionItemHeight = 22,
  accent = "#6a6048",
  bezelTitle = "",
}) {
  const pickerOptions = options.map((o) => ({
    value: o.value,
    label: o.label,
    textValue: typeof o.label === "string" ? o.label : String(o.value),
  }));

  return (
    <div
      style={{
        width: "100%",
        maxWidth: fullWidth ? "none" : maxWidthPx,
        margin: fullWidth ? 0 : "0 auto",
        alignSelf: fullWidth ? "stretch" : undefined,
        minWidth: 0,
        opacity: dimmed ? 0.45 : 1,
        pointerEvents: dimmed ? "none" : "auto",
        boxSizing: "border-box",
        overflow: "visible",
        padding: "2px 0",
      }}
    >
      {bezelTitle ? (
        <div
          style={{
            margin: "0 0 4px",
            padding: "0 2px",
            textAlign: "center",
            fontFamily: "monospace",
            fontSize: 7,
            lineHeight: 1.2,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: `${accent}cc`,
          }}
        >
          {bezelTitle}
        </div>
      ) : null}
      <div
        style={{
          borderRadius: 14,
          border: `1px solid ${accent}38`,
          background: "linear-gradient(180deg, rgba(10,12,16,0.96), rgba(4,5,8,0.98))",
          boxShadow: `0 0 0 1px ${accent}14 inset, 0 14px 32px rgba(0,0,0,0.42)`,
          padding: "4px 2px 6px",
        }}
      >
        <WheelPickerWrapper
          className={cn(
            "!rounded-lg !border-zinc-700/50 !bg-zinc-950/85 !px-0 !shadow-none",
            wrapperClassName,
          )}
        >
          <WheelPicker
            value={value}
            onValueChange={onValueChange}
            options={pickerOptions}
            infinite={infinite}
            visibleCount={visibleCount}
            optionItemHeight={optionItemHeight}
            dragSensitivity={1.05}
            scrollSensitivity={1.05}
          />
        </WheelPickerWrapper>
      </div>
    </div>
  );
}
