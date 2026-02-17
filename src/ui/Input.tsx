import React from "react";
import { cn } from "./cn";

export type UIInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Input({ className, label, hint, error, ...props }: UIInputProps) {
  return (
    <label className="block">
      {label ? <div className="mb-2 text-sm text-[var(--text-1)]">{label}</div> : null}
      <input
        className={cn(
          "ffaa-control h-12 w-full rounded-full px-4 text-[var(--text-0)] " +
            "placeholder:text-[rgba(255,255,255,0.45)] transition-all duration-200 ease-out focus:outline-none",
          error ? "border-[rgba(251,113,133,0.45)]" : "",
          className
        )}
        {...props}
      />
      {error ? (
        <div className="mt-2 text-sm text-[rgba(251,113,133,0.95)]">{error}</div>
      ) : hint ? (
        <div className="mt-2 text-sm text-[rgba(255,255,255,0.50)]">{hint}</div>
      ) : null}
    </label>
  );
}
