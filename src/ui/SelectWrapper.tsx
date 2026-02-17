import React from "react";
import { cn } from "./cn";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

export type UISelectProps = {
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
  label, 
  hint, 
  error, 
  value, 
  onValueChange, 
  children, 
  className,
  disabled 
}: UISelectProps) {
  return (
    <label className="block">
      {label ? <div className="mb-2 text-sm text-[var(--text-1)]">{label}</div> : null}
      <Select value={value ?? ""} onValueChange={onValueChange} disabled={disabled ?? false}>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Select an option..." />
        </SelectTrigger>
        <SelectContent>
          {children}
        </SelectContent>
      </Select>
      {error ? (
        <div className="mt-2 text-sm text-[rgba(251,113,133,0.95)]">{error}</div>
      ) : hint ? (
        <div className="mt-2 text-sm text-[rgba(255,255,255,0.50)]">{hint}</div>
      ) : null}
    </label>
  );
}

// Export SelectItem for convenience
export { SelectItem };
