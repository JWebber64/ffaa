import React from "react";
import { cn } from "./cn";

export type UIInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Input = React.forwardRef<HTMLInputElement, UIInputProps>(function Input(
  { className, label, hint, error, ...props },
  ref
) {
  return (
    <label className="ui-input block">
      {label ? <div className="ui-input-label mb-2 text-sm text-[var(--text-1)] tracking-[0.14em] uppercase">{label}</div> : null}
      <input
        ref={ref}
        className={cn(
          "ui-input-field",
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
});
