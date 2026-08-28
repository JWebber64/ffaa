import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";
import { ControlChevron } from "./ControlChevron";

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  position?: string | undefined;
};

type MenuPosition = {
  left: number;
  maxHeight: number;
  placement: "top" | "bottom";
  top: number;
  width: number;
};

type UniversalSelectProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "children" | "onChange" | "value" | "defaultValue" | "size"
> & {
  children: React.ReactNode;
  className?: string | undefined;
  defaultValue?: string | number | readonly string[] | undefined;
  onChange?: ((event: React.ChangeEvent<HTMLSelectElement>) => void) | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  size?: string | undefined;
  value?: string | number | readonly string[] | undefined;
};

function getScalarValue(value: string | number | readonly string[] | undefined) {
  if (Array.isArray(value)) return String(value[0] ?? "");
  return String(value ?? "");
}

function extractOptions(children: React.ReactNode): SelectOption[] {
  return React.Children.toArray(children)
    .filter(React.isValidElement)
    .map((child) => {
      const props = child.props as {
        children?: React.ReactNode;
        "data-position"?: string;
        disabled?: boolean;
        position?: string;
        value?: string | number;
      };
      const position = normalizePositionToken(props.position ?? props["data-position"]);

      return {
        value: String(props.value ?? ""),
        label: React.Children.toArray(props.children).join(""),
        disabled: Boolean(props.disabled),
        ...(position ? { position } : {}),
      };
    });
}

function normalizePositionToken(value: string | undefined) {
  const token = String(value ?? "").trim().toUpperCase();
  if (!token || token === "ALL") return undefined;
  if (token === "DEF" || token === "D/ST") return "DST";
  return token.replace(/[^A-Z0-9_-]/g, "");
}

function getPositionStyle(position: string | undefined) {
  if (!position) return undefined;

  return {
    "--select-position-color": `var(--pos-${position.toLowerCase()})`,
  } as React.CSSProperties;
}

function getNextEnabledIndex(options: SelectOption[], currentIndex: number, delta: number) {
  if (!options.length) return -1;

  for (let step = 1; step <= options.length; step += 1) {
    const nextIndex = (currentIndex + step * delta + options.length) % options.length;
    if (!options[nextIndex]?.disabled) return nextIndex;
  }

  return -1;
}

export const UniversalSelect = React.forwardRef<HTMLSelectElement, UniversalSelectProps>(
  (
    {
      children,
      className,
      defaultValue,
      disabled,
      id,
      onBlur,
      onChange,
      onFocus,
      onValueChange,
      required,
      size,
      style,
      value,
      ...selectProps
    },
    ref
  ) => {
    const generatedId = useId();
    const buttonId = id ? `${id}-trigger` : `${generatedId}-trigger`;
    const listboxId = `${buttonId}-listbox`;
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const selectRef = useRef<HTMLSelectElement | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
    const options = useMemo(() => extractOptions(children), [children]);
    const firstEnabledValue = options.find((option) => !option.disabled)?.value ?? "";
    const [internalValue, setInternalValue] = useState(
      getScalarValue(defaultValue ?? value ?? firstEnabledValue)
    );
    const selectedValue = value === undefined ? internalValue : getScalarValue(value);
    const selectedIndex = options.findIndex((option) => option.value === selectedValue);
    const selectedOption = options[selectedIndex] ?? options.find((option) => !option.disabled);

    const updateMenuPosition = useCallback(() => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 8;
      const gap = 7;
      const usableWidth = Math.max(120, window.innerWidth - viewportPadding * 2);
      const width = Math.min(rect.width, usableWidth);
      const left = Math.min(
        Math.max(rect.left, viewportPadding),
        window.innerWidth - width - viewportPadding
      );
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const placement = spaceBelow < 220 && spaceAbove > spaceBelow ? "top" : "bottom";
      const availableHeight = Math.max(
        96,
        (placement === "top" ? spaceAbove : spaceBelow) - gap
      );
      const maxHeight = Math.min(310, availableHeight);
      const preferredTop =
        placement === "top" ? rect.top - gap - maxHeight : rect.bottom + gap;
      const top = Math.min(
        Math.max(preferredTop, viewportPadding),
        window.innerHeight - maxHeight - viewportPadding
      );

      setMenuPosition({ left, maxHeight, placement, top, width });
    }, []);

    useEffect(() => {
      function handleOutsideClick(event: MouseEvent) {
        const target = event.target as Node;
        if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
          setIsOpen(false);
        }
      }

      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    useEffect(() => {
      if (value === undefined && selectedIndex < 0 && firstEnabledValue) {
        setInternalValue(firstEnabledValue);
      }
    }, [firstEnabledValue, selectedIndex, value]);

    useEffect(() => {
      if (!isOpen) return;

      updateMenuPosition();
      window.addEventListener("resize", updateMenuPosition);
      window.addEventListener("scroll", updateMenuPosition, true);
      return () => {
        window.removeEventListener("resize", updateMenuPosition);
        window.removeEventListener("scroll", updateMenuPosition, true);
      };
    }, [isOpen, options.length, updateMenuPosition]);

    function setRefs(node: HTMLSelectElement | null) {
      selectRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLSelectElement | null>).current = node;
    }

    function commit(nextValue: string) {
      const option = options.find((item) => item.value === nextValue);
      if (!option || option.disabled || disabled) return;

      if (value === undefined) setInternalValue(nextValue);
      if (selectRef.current) selectRef.current.value = nextValue;
      onValueChange?.(nextValue);
      onChange?.({
        currentTarget: selectRef.current ?? ({ value: nextValue } as HTMLSelectElement),
        target: selectRef.current ?? ({ value: nextValue } as HTMLSelectElement),
      } as React.ChangeEvent<HTMLSelectElement>);
      setIsOpen(false);
    }

    function toggleMenu() {
      if (disabled) return;
      if (isOpen) {
        setIsOpen(false);
        return;
      }

      updateMenuPosition();
      setIsOpen(true);
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
      if (disabled) return;

      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleMenu();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const fallbackIndex = selectedIndex >= 0 ? selectedIndex : 0;
        const nextIndex = getNextEnabledIndex(
          options,
          fallbackIndex,
          event.key === "ArrowDown" ? 1 : -1
        );
        const nextOption = options[nextIndex];
        if (nextOption) commit(nextOption.value);
      }
    }

    const menu =
      isOpen && menuPosition
        ? createPortal(
            <div
              className="ffaa-custom-select-popover"
              data-placement={menuPosition.placement}
              style={{
                left: menuPosition.left,
                top: menuPosition.top,
                width: menuPosition.width,
              }}
            >
              <div
                className="ffaa-custom-select-menu"
                id={listboxId}
                ref={menuRef}
                role="listbox"
                style={{ maxHeight: menuPosition.maxHeight }}
              >
                {options.map((option) => {
                  const selected = option.value === selectedOption?.value;
                  return (
                    <button
                      aria-selected={selected}
                      className={cn(
                        "ffaa-custom-select-option",
                        selected ? "is-selected" : "",
                        option.disabled ? "is-disabled" : ""
                      )}
                      data-position={option.position}
                      disabled={option.disabled}
                      key={option.value}
                      onClick={() => commit(option.value)}
                      role="option"
                      style={getPositionStyle(option.position)}
                      type="button"
                    >
                      <span className="ffaa-custom-select-option-label">
                        {option.position ? (
                          <span className="ffaa-custom-select-option-swatch" aria-hidden="true" />
                        ) : null}
                        <span>{option.label}</span>
                      </span>
                      {selected ? <span className="ffaa-custom-select-check" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )
        : null;

    return (
      <div className="ffaa-custom-select" ref={rootRef} style={style}>
        <select
          {...selectProps}
          aria-hidden="true"
          className="ffaa-native-select-proxy"
          disabled={disabled}
          id={id}
          onChange={onChange ?? (() => {})}
          ref={setRefs}
          required={required}
          tabIndex={-1}
          value={selectedOption?.value ?? ""}
        >
          {children}
        </select>

        <button
          aria-label={
            selectProps["aria-label"]
              ? `${selectProps["aria-label"]}: ${selectedOption?.label || "Select"}`
              : undefined
          }
          aria-labelledby={selectProps["aria-labelledby"]}
          aria-controls={listboxId}
          aria-disabled={disabled || undefined}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className={cn("ffaa-custom-select-trigger", className)}
          data-position={selectedOption?.position}
          data-size={size}
          disabled={disabled}
          id={buttonId}
          onBlur={(event) => onBlur?.(event as unknown as React.FocusEvent<HTMLSelectElement>)}
          onClick={toggleMenu}
          onFocus={(event) => onFocus?.(event as unknown as React.FocusEvent<HTMLSelectElement>)}
          onKeyDown={handleKeyDown}
          ref={triggerRef}
          style={getPositionStyle(selectedOption?.position)}
          title={selectProps.title}
          type="button"
        >
          <span className="ffaa-custom-select-value">
            {selectedOption?.position ? (
              <span className="ffaa-custom-select-value-swatch" aria-hidden="true" />
            ) : null}
            <span className="ffaa-custom-select-value-label">
              {selectedOption?.label || "Select"}
            </span>
          </span>
          <span className="ffaa-custom-select-icon" aria-hidden="true">
            <ControlChevron kind="select" />
          </span>
        </button>

        {menu}
      </div>
    );
  }
);

UniversalSelect.displayName = "UniversalSelect";
