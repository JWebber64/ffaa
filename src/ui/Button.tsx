import React from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export type UIButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
};

const base =
  "inline-flex items-center justify-center gap-2 select-none " +
  "rounded-[12px] font-semibold tracking-tight " +
  "transform-gpu transition-[background-color,border-color,box-shadow,filter,transform] duration-200 ease-out " +
  "hover:scale-[1.015] active:scale-[0.99] active:brightness-95 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-0 " +
  "disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:brightness-100 disabled:active:scale-100 disabled:active:brightness-100";

const sizes: Record<NonNullable<UIButtonProps["size"]>, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-11 px-6 text-sm",
  lg: "h-12 px-7 text-base",
};

const variants: Record<Variant, string> = {
  primary:
    "text-[var(--color-button-primary-text)] " +
    "bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] " +
    "border border-[var(--color-button-primary-border)] shadow-[var(--shadow-control)]",

  secondary:
    "text-[var(--color-button-secondary-text)] " +
    "bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-hover)] " +
    "border border-[var(--color-border-default)] shadow-[var(--shadow-control)]",

  ghost:
    "border border-transparent bg-transparent text-[var(--color-text-secondary)] " +
    "hover:border-[var(--color-border-subtle)] hover:bg-[var(--color-button-quiet-hover)] hover:text-[var(--color-text-primary)]",

  danger:
    "border border-[color-mix(in_oklch,var(--color-status-danger)_46%,transparent)] text-[var(--color-text-primary)] " +
    "bg-[color-mix(in_oklch,var(--color-status-danger)_13%,var(--color-surface-card-secondary))] " +
    "hover:bg-[color-mix(in_oklch,var(--color-status-danger)_19%,var(--color-surface-card-secondary))] shadow-[var(--shadow-control)]",
};

export const Button = React.forwardRef<HTMLButtonElement, UIButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    isLoading,
    disabled,
    children,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "ui-button",
        `ui-button-${variant}`,
        `ui-button-${size}`,
        base,
        sizes[size],
        variants[variant],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <span>Loading</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
});
