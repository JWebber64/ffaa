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
      {label ? <div className="mb-2 text-sm text-fg1">{label}</div> : null}
      <input
        className={cn(
          "h-11 w-full rounded-md border border-stroke bg-[rgba(255,255,255,0.04)] px-3 text-fg0 " +
            "placeholder:text-fg2 transition focus:border-stroke2 focus:outline-none",
          error ? "border-[rgba(251,113,133,0.45)]" : "",
          className
        )}
        {...props}
      />
      {error ? (
        <div className="mt-2 text-sm text-[rgba(251,113,133,0.95)]">{error}</div>
      ) : hint ? (
        <div className="mt-2 text-sm text-fg2">{hint}</div>
      ) : null}
    </label>
  );
}
