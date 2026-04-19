/*
 * Adapted from the Realmorphism knob control.
 * Source: F:\dev\realmorphism\src\components\ui\knob.tsx
 * Licensed under the MIT License.
 */

import * as React from "react";

import { cn } from "../../lib/utils.ts";

type KnobMode = "power" | "balance" | "tuner";
type KnobSize = "sm" | "md" | "lg";

type KnobProps = {
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  wheelMultiplier?: number;
  dragMultiplier?: number;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  mode?: KnobMode;
  size?: KnobSize;
  theme?: "light" | "dark";
  className?: string;
  disabled?: boolean;
  showReadout?: boolean;
  showLabel?: boolean;
  active?: boolean;
  defaultActive?: boolean;
  onActiveChange?: (active: boolean) => void;
  clickTogglesActive?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function decimalPlaces(value: number) {
  const text = String(value);
  if (!text.includes(".")) {
    return 0;
  }

  return text.split(".")[1]?.length ?? 0;
}

function roundToStep(value: number, step: number, min: number) {
  const precision = Math.max(decimalPlaces(step), decimalPlaces(min));
  const next = Math.round((value - min) / step) * step + min;
  return Number(next.toFixed(precision));
}

function knobSizeClass(size: KnobSize) {
  switch (size) {
    case "sm":
      return "w-16";
    case "lg":
      return "w-24";
    case "md":
    default:
      return "w-20";
  }
}

export function Knob({
  label,
  unit,
  min = 0,
  max = 100,
  step = 1,
  wheelMultiplier = 1,
  dragMultiplier = 1,
  value,
  defaultValue = min,
  onValueChange,
  mode = "power",
  size = "md",
  theme = "dark",
  className,
  disabled = false,
  showReadout = true,
  showLabel = true,
  active,
  defaultActive = true,
  onActiveChange,
  clickTogglesActive,
}: KnobProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const hostRef = React.useRef<HTMLFieldSetElement>(null);
  const knobRef = React.useRef<HTMLDivElement>(null);
  const dragPointerIdRef = React.useRef<number | null>(null);
  const lastPointerXRef = React.useRef<number | null>(null);
  const lastPointerYRef = React.useRef<number | null>(null);
  const dragAccumulatorRef = React.useRef(0);
  const didDragRef = React.useRef(false);
  const activeAtPointerDownRef = React.useRef(defaultActive);
  const inputId = React.useId();
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const isControlled = typeof value === "number";
  const currentValue = isControlled ? value : uncontrolledValue;
  const isActiveControlled = typeof active === "boolean";
  const [uncontrolledActive, setUncontrolledActive] = React.useState(defaultActive);
  const currentActive = isActiveControlled ? active : uncontrolledActive;
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  const safeStep = step > 0 ? step : 1;
  const normalizedValue = clamp(currentValue, safeMin, safeMax);
  const span = Math.abs(safeMin) + Math.abs(safeMax) || 1;
  const rawPercent = (normalizedValue / span) * 100;
  const isBalance = mode === "balance";
  const isTuner = mode === "tuner";
  const isCenteredMode = isBalance || isTuner;
  const isLight = theme === "light";
  const balanceExtent = Math.max(Math.abs(safeMin), Math.abs(safeMax)) || 1;
  const balancePercent = clamp(Math.abs(normalizedValue) / balanceExtent, 0, 1);
  const hasBalanceHighlight = balancePercent > 0;
  const valueSweep = clamp((normalizedValue - safeMin) / (safeMax - safeMin || 1), 0, 1);
  const wheelStep = safeStep * 1.5 * Math.max(wheelMultiplier, 0.1);
  const formattedValue = isBalance
    ? normalizedValue === 0
      ? "0"
      : `+${Math.abs(normalizedValue)}`
    : isTuner
      ? normalizedValue === 0
        ? "0"
        : normalizedValue > 0
          ? `+${Math.abs(normalizedValue)}`
          : `${normalizedValue}`
      : `${normalizedValue}`;
  const formattedUnit = isBalance
    ? normalizedValue < 0
      ? "left"
      : normalizedValue > 0
        ? "right"
        : "center"
    : unit ?? "level";
  const rotation = isCenteredMode ? rawPercent * 2.64 : rawPercent * 2.64 - 132;
  const powerOffset = `${184 - 184 * valueSweep}`;
  const balanceDash = `${balancePercent * 100} 100`;
  const tickCount = isTuner ? 12 : isBalance ? 10 : 8;
  const tickMarks = Array.from({ length: tickCount }, (_, index) => index);
  const allowsActiveToggle = clickTogglesActive ?? mode === "power";
  const isPressed = isDragging;
  const ringStroke = currentActive
    ? "#ff00ff"
    : isLight
      ? "#8f8c87"
      : "#55595C";
  const ringOpacity = currentActive ? 1 : 0.28;

  const normalizedValueRef = React.useRef(normalizedValue);
  React.useEffect(() => {
    normalizedValueRef.current = normalizedValue;
  }, [normalizedValue]);

  React.useEffect(() => {
    activeAtPointerDownRef.current = currentActive;
  }, [currentActive]);

  const setValue = React.useCallback(
    (nextValue: number) => {
      const clampedValue = clamp(roundToStep(nextValue, safeStep, safeMin), safeMin, safeMax);

      if (!isControlled) {
        setUncontrolledValue(clampedValue);
      }

      onValueChange?.(clampedValue);
    },
    [isControlled, onValueChange, safeMax, safeMin, safeStep],
  );

  const setActive = React.useCallback(
    (nextActive: boolean) => {
      if (!isActiveControlled) {
        setUncontrolledActive(nextActive);
      }
      onActiveChange?.(nextActive);
    },
    [isActiveControlled, onActiveChange],
  );

  React.useEffect(() => {
    if (!isDragging || disabled) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (dragPointerIdRef.current !== event.pointerId) {
        return;
      }

      if (lastPointerXRef.current === null || lastPointerYRef.current === null) {
        lastPointerXRef.current = event.clientX;
        lastPointerYRef.current = event.clientY;
        return;
      }

      const deltaX = event.clientX - lastPointerXRef.current;
      const deltaY = event.clientY - lastPointerYRef.current;
      const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : -deltaY;
      lastPointerXRef.current = event.clientX;
      lastPointerYRef.current = event.clientY;

      if (delta === 0) {
        return;
      }

      didDragRef.current = true;
      event.preventDefault();
      const dragPixelsPerStep = (isTuner ? 6 : 8) / Math.max(dragMultiplier, 0.1);
      dragAccumulatorRef.current += delta / dragPixelsPerStep;

      const wholeSteps = Math.trunc(dragAccumulatorRef.current);
      if (wholeSteps === 0) {
        return;
      }

      dragAccumulatorRef.current -= wholeSteps;
      setValue(normalizedValueRef.current + wholeSteps * safeStep);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (dragPointerIdRef.current !== event.pointerId) {
        return;
      }

      if (knobRef.current?.hasPointerCapture(event.pointerId)) {
        knobRef.current.releasePointerCapture(event.pointerId);
      }

      dragPointerIdRef.current = null;
      lastPointerXRef.current = null;
      lastPointerYRef.current = null;
      dragAccumulatorRef.current = 0;
      const shouldToggleActive = allowsActiveToggle && !disabled && !didDragRef.current;
      didDragRef.current = false;
      setIsDragging(false);
      inputRef.current?.select();

      if (shouldToggleActive) {
        setActive(!activeAtPointerDownRef.current);
      }
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (dragPointerIdRef.current !== event.pointerId) {
        return;
      }

      if (knobRef.current?.hasPointerCapture(event.pointerId)) {
        knobRef.current.releasePointerCapture(event.pointerId);
      }

      dragPointerIdRef.current = null;
      lastPointerXRef.current = null;
      lastPointerYRef.current = null;
      dragAccumulatorRef.current = 0;
      didDragRef.current = false;
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", handlePointerUp, { capture: true });
    window.addEventListener("pointercancel", handlePointerCancel, { capture: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true });
      window.removeEventListener("pointercancel", handlePointerCancel, { capture: true });
    };
  }, [allowsActiveToggle, disabled, dragMultiplier, isDragging, safeStep, setActive, setValue]);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || disabled) {
      return;
    }

    const wheelOpts = { passive: false as const, capture: true as const };

    const handleWheel = (event: WheelEvent) => {
      if (!host.contains(event.target as Node)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const dominantDelta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (dominantDelta === 0) {
        return;
      }
      if (dominantDelta < 0) {
        setValue(normalizedValueRef.current - wheelStep);
      } else {
        setValue(normalizedValueRef.current + wheelStep);
      }
    };

    host.addEventListener("wheel", handleWheel, wheelOpts);
    return () => host.removeEventListener("wheel", handleWheel, wheelOpts);
  }, [disabled, setValue, wheelStep]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue =
      event.currentTarget.value === "" ? safeMin : Number(event.currentTarget.value);
    if (Number.isFinite(nextValue)) {
      setValue(nextValue);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }

    switch (event.key) {
      case "ArrowUp":
      case "ArrowRight":
      case "+":
        event.preventDefault();
        setValue(normalizedValue + safeStep);
        break;
      case "ArrowDown":
      case "ArrowLeft":
      case "-":
        event.preventDefault();
        setValue(normalizedValue - safeStep);
        break;
      case "Home":
        event.preventDefault();
        setValue(isBalance ? 0 : safeMin);
        break;
      case "End":
        event.preventDefault();
        setValue(safeMax);
        break;
      default:
        break;
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (disabled) {
      return;
    }

    event.preventDefault();
    activeAtPointerDownRef.current = currentActive;
    dragPointerIdRef.current = event.pointerId;
    lastPointerXRef.current = event.clientX;
    lastPointerYRef.current = event.clientY;
    dragAccumulatorRef.current = 0;
    didDragRef.current = false;
    knobRef.current?.setPointerCapture(event.pointerId);
    setIsDragging(true);
    inputRef.current?.focus({ preventScroll: true });
  };

  const defaultReset = isCenteredMode ? 0 : defaultValue;

  const handleDoubleClick = () => {
    if (disabled) {
      return;
    }

    setValue(defaultReset);
  };

  return (
    <fieldset
      ref={hostRef}
      className={cn(
        "group relative inline-flex flex-col items-center gap-2 border-0 p-0 text-center font-mono text-sm",
        knobSizeClass(size),
        className,
      )}
    >
      <div
        ref={knobRef}
        className={cn(
          "relative mx-auto aspect-square w-full select-none rounded-full overflow-hidden touch-none transition-transform duration-150",
          isPressed
            ? "translate-y-[4px] scale-[0.95]"
            : isHovered
              ? "scale-[1.01]"
              : "scale-100",
          isLight
            ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-10px_18px_rgba(0,0,0,0.12)]"
            : "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-14px_22px_rgba(0,0,0,0.52)]",
          isPressed
            ? isLight
              ? "shadow-[inset_0_3px_10px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.32),0_3px_8px_rgba(0,0,0,0.16)]"
              : "shadow-[inset_0_4px_12px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.06),0_4px_10px_rgba(0,0,0,0.38)]"
            : "",
        )}
        style={{
          backgroundImage: isLight
            ? "radial-gradient(circle at 30% 28%, rgba(255,255,255,0.95) 0%, rgba(247,243,235,0.98) 30%, rgba(226,220,211,1) 62%, rgba(200,193,184,1) 100%)"
            : "radial-gradient(circle at 30% 28%, rgba(82,85,88,0.98) 0%, rgba(44,45,47,1) 34%, rgba(28,30,32,1) 70%, rgba(18,19,21,1) 100%)",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        role={allowsActiveToggle ? "button" : undefined}
        tabIndex={allowsActiveToggle ? 0 : undefined}
        aria-pressed={allowsActiveToggle ? currentActive : undefined}
        aria-label={allowsActiveToggle ? `${label} power ${currentActive ? "on" : "off"}` : undefined}
        onKeyDown={(event) => {
          if (!allowsActiveToggle || disabled) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setActive(!currentActive);
          }
        }}
      >
        <div
          className={cn(
            "absolute inset-[6%] rounded-full border",
            isHovered
              ? isLight
                ? "border-white/65"
                : "border-white/20"
              : isLight
                ? "border-white/45"
                : "border-white/10",
          )}
        />
        <div
          className={cn(
            "absolute inset-[12%] rounded-full",
            isLight
              ? "bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.18),transparent_42%)]"
              : "bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.08),transparent_42%)]",
          )}
        />

        <svg
          className="absolute left-1/2 top-0 h-full w-full -translate-x-1/2"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <g opacity={isLight ? 0.32 : 0.55}>
            {tickMarks.map((mark) => {
              const angle = -132 + (264 / (tickCount - 1)) * mark;
              return (
                <line
                  key={mark}
                  x1="50"
                  y1="12"
                  x2="50"
                  y2={mark % 3 === 0 ? "20" : "17"}
                  stroke={isLight ? "#645f59" : "#dcdcdc"}
                  strokeWidth={mark % 3 === 0 ? "1.7" : "1"}
                  strokeLinecap="round"
                  transform={`rotate(${angle} 50 50)`}
                />
              );
            })}
          </g>
          <path
            d="M20,76 A 40 40 0 1 1 80 76"
            fill="none"
            stroke={isLight ? "#8f8c87" : "#55595C"}
            strokeWidth="5"
          />
          {isBalance ? (
            hasBalanceHighlight ? (
              <path
                d={
                  normalizedValue >= 0 ? "M50,10 A 40 40 0 0 1 80 76" : "M50,10 A 40 40 0 0 0 20 76"
                }
                pathLength="100"
                fill="none"
                stroke={ringStroke}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={balanceDash}
                strokeOpacity={ringOpacity}
              />
            ) : null
          ) : (
            <path
              d="M20,76 A 40 40 0 1 1 80 76"
              fill="none"
              stroke={ringStroke}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="184 184"
              strokeDashoffset={powerOffset}
              strokeOpacity={ringOpacity}
            />
          )}
        </svg>

        <div
          className="pointer-events-none absolute inset-[18%] z-10"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div
            className={cn(
              "absolute bottom-1/2 left-1/2 h-[52%] w-[4px] -translate-x-1/2 rounded-full shadow-[0_0_6px_rgba(0,0,0,0.25)]",
              isLight ? "bg-[#4f4a45]" : "bg-[#f4f4f4]",
            )}
          />
          <div
            className={cn(
              "absolute bottom-1/2 left-1/2 h-[58%] w-[1px] -translate-x-1/2 rounded-full",
              isLight ? "bg-white/75" : "bg-white/30",
            )}
          />
        </div>
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 z-20 h-[12%] w-[12%] -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_6px_rgba(0,0,0,0.25)] transition-transform duration-150",
            currentActive
              ? isLight
                ? "border-[#8f8c87] bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.95),#ddd4ca_70%,#c4bbb0_100%)]"
                : "border-[#181b1c] bg-[radial-gradient(circle_at_35%_35%,rgba(79,83,86,1),#3a3d40_70%,#232629_100%)]"
              : isLight
                ? "border-[#b3aca3] bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.78),#cfc7bc_70%,#b8aea3_100%)]"
                : "border-[#2a2d30] bg-[radial-gradient(circle_at_35%_35%,rgba(56,60,63,1),#2a2d30_70%,#17191b_100%)]",
          )}
        />
        <div
          className={cn(
            "absolute inset-0 rounded-full border",
            isLight ? "border-[#8f8c87]" : "border-[#181b1c]",
          )}
        />
        <div
          className={cn(
            "absolute inset-[14%] rounded-full",
            isLight ? "bg-[#e8e1d7]" : "bg-[#2c2d2f]",
          )}
        />
        <div
          className={cn(
            "absolute inset-[22%] rounded-full opacity-10",
            isLight ? "bg-[#ffffff]" : "bg-[#e4e8ea]",
          )}
        />
      </div>

      {showReadout ? (
        <div
          className={cn(
            "mt-2 grid min-h-[1rem] w-full grid-cols-[4ch_6ch] items-baseline justify-center gap-2 tabular-nums",
            isLight ? "text-[#37332f]" : "text-[#e4e8ea]",
          )}
        >
          <span className="inline-block text-right text-[0.95rem] leading-none">
            {formattedValue}
          </span>
          <span
            className={cn(
              "inline-block text-left text-[0.65rem] uppercase tracking-[0.18em]",
              isLight ? "text-[#787169]" : "text-[#888]",
            )}
          >
            {formattedUnit}
          </span>
        </div>
      ) : null}

      <input
        ref={inputRef}
        id={inputId}
        type="number"
        value={normalizedValue}
        min={safeMin}
        max={safeMax}
        step={safeStep}
        disabled={disabled}
        aria-label={label}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="sr-only"
      />

      {showLabel ? (
        <label
          className={cn(
            "relative block w-full select-none pt-1",
            isLight ? "text-[#35312c]" : "text-[#e4e8ea]",
          )}
          htmlFor={inputId}
        >
          <span className="block text-[0.9rem] leading-none">{label}</span>
        </label>
      ) : null}
    </fieldset>
  );
}
