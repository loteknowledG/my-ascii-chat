import { WheelPicker, WheelPickerWrapper } from "./wheel-picker";

/**
 * Stable rotary wheel + light “fish bowl” bezel (no nested 3D, no flex squash, no clip).
 * @ncdai: visibleCount must be a multiple of 4 — 16 shows a clear cylinder stack.
 */
export default function VoiceAdaptiveWheel({
  value,
  onValueChange,
  options,
  infinite = true,
  wrapperClassName = "",
  dimmed = false,
  maxWidthPx = 240,
  accent = "#6a6048",
}) {
  const glow = `${accent}35`;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: maxWidthPx,
        margin: "0 auto",
        minWidth: 0,
        opacity: dimmed ? 0.45 : 1,
        pointerEvents: dimmed ? "none" : "auto",
        boxSizing: "border-box",
        overflow: "visible",
        padding: "6px 0",
      }}
    >
      {/* Bezel + bowl tint — flat stack only; wheel owns all 3D */}
      <div
        style={{
          borderRadius: 18,
          border: "2px solid #12100e",
          background: `
            radial-gradient(ellipse 95% 80% at 50% 18%, rgba(255,255,255,0.07), transparent 42%),
            radial-gradient(ellipse 110% 90% at 50% 100%, rgba(0,0,0,0.55), transparent 48%),
            linear-gradient(168deg, #151311, #070605)
          `,
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.04) inset,
            0 8px 22px rgba(0,0,0,0.55),
            0 0 18px ${glow}
          `,
          padding: "10px 8px",
          overflow: "visible",
        }}
      >
        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.75)",
            background:
              "radial-gradient(ellipse 90% 70% at 50% 25%, rgba(40,56,44,0.2), transparent 50%), #030403",
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -10px 24px rgba(0,0,0,0.65), inset 0 0 0 1px ${glow}`,
            overflow: "visible",
          }}
        >
          {options.length ? (
            <WheelPickerWrapper
              className={`w-full min-w-0 max-w-full border-0 bg-transparent px-0 py-0 shadow-none ${wrapperClassName}`.trim()}
            >
              <WheelPicker
                value={value}
                onValueChange={onValueChange}
                options={options}
                classNames={{
                  optionItem: "whitespace-nowrap text-[13px]",
                  highlightItem: "whitespace-nowrap text-[13px]",
                }}
                visibleCount={16}
                optionItemHeight={30}
                infinite={infinite}
              />
            </WheelPickerWrapper>
          ) : null}
        </div>
      </div>
    </div>
  );
}
