import React from "react";
import { cn } from "./cn";
import { UniversalSelect } from "./UniversalSelect";

export type UISelectProps = {
  ariaLabel?: string;
  label?: string;
  hint?: string;
  error?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

export function SelectWrapper({
  ariaLabel,
  label,
  hint,
  error,
  value,
  onValueChange,
  children,
  className,
  disabled,
}: UISelectProps) {
  return (
    <div className="ffaa-select-wrap">
      {label ? <div className="ffaa-select-label">{label}</div> : null}
      <UniversalSelect
        aria-label={ariaLabel ?? label}
        value={value ?? ""}
        disabled={disabled ?? false}
        onValueChange={onValueChange}
        className={cn("select-trigger", className)}
      >
        {children}
      </UniversalSelect>
      {error ? (
        <div className="mt-2 text-sm text-[rgba(251,113,133,0.95)]">{error}</div>
      ) : hint ? (
        <div className="mt-2 text-sm text-[rgba(255,255,255,0.50)]">{hint}</div>
      ) : null}
    </div>
  );
}

export function SelectItem({
  value,
  children,
  disabled,
  position,
}: {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
  position?: string | undefined;
}) {
  return (
    <option value={value} disabled={disabled} data-position={position}>
      {children}
    </option>
  );
}
