import React, { useMemo, useRef } from "react";

import { cn } from "./cn";
import { ControlChevron } from "./ControlChevron";

export type NumericInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  shellClassName?: string;
};

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
}

function decimalPlaces(value: number) {
  const source = String(value).toLowerCase();
  if (source.includes("e-")) return Number(source.split("e-")[1]) || 0;
  return source.includes(".") ? (source.split(".")[1] ?? "").length : 0;
}

function setReactInputValue(input: HTMLInputElement, value: number) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, String(value));
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(function NumericInput(
  {
    "aria-label": ariaLabel,
    className,
    disabled,
    max,
    min,
    readOnly,
    shellClassName,
    step = 1,
    style,
    value,
    ...props
  },
  forwardedRef
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const numericStep = Number(step) > 0 ? Number(step) : 1;
  const numericMin = min === undefined ? undefined : Number(min);
  const numericMax = max === undefined ? undefined : Number(max);
  const currentValue = value === undefined || value === "" ? Number.NaN : Number(value);
  const label = ariaLabel || props.name || "value";
  const shellStyle = useMemo<React.CSSProperties>(() => {
    const dimensions: React.CSSProperties = {};
    if (style?.width !== undefined) dimensions.width = style.width;
    if (style?.minWidth !== undefined) dimensions.minWidth = style.minWidth;
    if (style?.maxWidth !== undefined) dimensions.maxWidth = style.maxWidth;
    return dimensions;
  }, [style?.maxWidth, style?.minWidth, style?.width]);

  const stepBy = (direction: 1 | -1) => {
    const input = inputRef.current;
    if (!input || disabled || readOnly) return;
    const current = input.valueAsNumber;
    let next = Number.isFinite(current)
      ? current + direction * numericStep
      : direction > 0
        ? Number.isFinite(numericMin) ? numericMin! : numericStep
        : Number.isFinite(numericMax) ? numericMax! : -numericStep;
    if (Number.isFinite(numericMin)) next = Math.max(numericMin!, next);
    if (Number.isFinite(numericMax)) next = Math.min(numericMax!, next);
    const precision = Math.max(decimalPlaces(numericStep), decimalPlaces(Number.isFinite(current) ? current : next));
    setReactInputValue(input, Number(next.toFixed(precision)));
  };

  const incrementDisabled = Boolean(disabled || readOnly || (Number.isFinite(numericMax) && Number.isFinite(currentValue) && currentValue >= numericMax!));
  const decrementDisabled = Boolean(disabled || readOnly || (Number.isFinite(numericMin) && Number.isFinite(currentValue) && currentValue <= numericMin!));

  return (
    <span className={cn("ffaa-number-field", shellClassName)} style={shellStyle}>
      <input
        {...props}
        ref={(node) => {
          inputRef.current = node;
          assignRef(forwardedRef, node);
        }}
        aria-label={ariaLabel}
        className={className}
        disabled={disabled}
        max={max}
        min={min}
        readOnly={readOnly}
        step={step}
        style={{ ...style, width: "100%", paddingRight: "46px" }}
        type="number"
        value={value}
      />
      <span className="ffaa-number-stepper">
        <span className="ffaa-number-stepper-visual" aria-hidden="true">
          <ControlChevron kind="stepper" />
        </span>
        <button
          aria-label={`Increase ${label}`}
          className="ffaa-number-stepper-hit-up"
          disabled={incrementDisabled}
          onClick={() => stepBy(1)}
          type="button"
        />
        <button
          aria-label={`Decrease ${label}`}
          className="ffaa-number-stepper-hit-down"
          disabled={decrementDisabled}
          onClick={() => stepBy(-1)}
          type="button"
        />
      </span>
    </span>
  );
});
