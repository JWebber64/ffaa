import type { CSSProperties } from "react";
import { cn } from "./cn";
import type { PositionToggleOption } from "./positionToggleOptions";

type PositionToggleProps<TValue extends string = string> = {
  options: readonly PositionToggleOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  ariaLabel: string;
  className?: string | undefined;
  disabled?: boolean | undefined;
};

function normalizePositionToken(value: string | undefined) {
  if (!value) return undefined;

  const token = value.toUpperCase().replace(/[^A-Z]/g, "");
  if (!token || token === "ALL") return undefined;
  if (token === "DEF" || token === "DST") return "dst";

  return token.toLowerCase();
}

function getPositionToggleColor(option: PositionToggleOption) {
  const token = normalizePositionToken(option.position ?? option.value);
  return token ? `var(--pos-${token})` : "var(--a2)";
}

function getToggleStyle(option: PositionToggleOption) {
  return {
    "--position-toggle-color": getPositionToggleColor(option),
  } as CSSProperties;
}

export function PositionToggle<TValue extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  disabled,
}: PositionToggleProps<TValue>) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn("ffaa-position-toggle", className)}
      data-option-count={options.length}
      role="group"
      style={{ "--position-toggle-count": options.length } as CSSProperties}
    >
      {options.map((option) => {
        const active = value === option.value;
        const optionDisabled = disabled || option.disabled;

        return (
          <button
            aria-pressed={active}
            className={cn("ffaa-position-button", active ? "is-active" : "")}
            disabled={optionDisabled}
            key={option.value}
            onClick={() => onChange(option.value)}
            style={getToggleStyle(option)}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
