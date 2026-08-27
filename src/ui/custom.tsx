/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useToast as useToastInternal } from "./toastContext";
import { UniversalSelect } from "./UniversalSelect";
import { NumericInput } from "./NumericInput";

type AnyRecord = Record<string, any>;
type CustomProps = Omit<React.HTMLAttributes<HTMLElement>, "color"> & {
  as?: React.ElementType;
  children?: React.ReactNode;
  [key: string]: any;
};

const breakpoints: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

const propAliases: Record<string, string[]> = {
  bg: ["background"],
  backgroundColor: ["backgroundColor"],
  borderColor: ["borderColor"],
  borderRadius: ["borderRadius"],
  rounded: ["borderRadius"],
  p: ["padding"],
  px: ["paddingLeft", "paddingRight"],
  py: ["paddingTop", "paddingBottom"],
  pt: ["paddingTop"],
  pr: ["paddingRight"],
  pb: ["paddingBottom"],
  pl: ["paddingLeft"],
  m: ["margin"],
  mx: ["marginLeft", "marginRight"],
  my: ["marginTop", "marginBottom"],
  mt: ["marginTop"],
  mr: ["marginRight"],
  mb: ["marginBottom"],
  ml: ["marginLeft"],
  w: ["width"],
  h: ["height"],
  minW: ["minWidth"],
  maxW: ["maxWidth"],
  minH: ["minHeight"],
  maxH: ["maxHeight"],
  boxSize: ["width", "height"],
};

const styleProps = new Set([
  "alignContent",
  "alignItems",
  "alignSelf",
  "aspectRatio",
  "backdropFilter",
  "background",
  "backgroundColor",
  "bg",
  "border",
  "borderBottom",
  "borderBottomColor",
  "borderBottomWidth",
  "borderColor",
  "borderLeft",
  "borderRadius",
  "borderRight",
  "borderStyle",
  "borderTop",
  "borderWidth",
  "bottom",
  "boxShadow",
  "boxSize",
  "color",
  "columnGap",
  "cursor",
  "display",
  "filter",
  "flex",
  "flexBasis",
  "flexDirection",
  "flexGrow",
  "flexShrink",
  "flexWrap",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "gap",
  "gridArea",
  "gridAutoColumns",
  "gridAutoRows",
  "gridColumn",
  "gridTemplateColumns",
  "gridTemplateRows",
  "h",
  "height",
  "inset",
  "justify",
  "justifyContent",
  "justifyItems",
  "left",
  "letterSpacing",
  "lineHeight",
  "m",
  "margin",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginTop",
  "maxH",
  "maxHeight",
  "maxW",
  "maxWidth",
  "mb",
  "minH",
  "minHeight",
  "minW",
  "minWidth",
  "ml",
  "mr",
  "mt",
  "mx",
  "my",
  "objectFit",
  "opacity",
  "overflow",
  "overflowX",
  "overflowY",
  "p",
  "padding",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "pb",
  "placeItems",
  "pl",
  "pointerEvents",
  "position",
  "pr",
  "pt",
  "px",
  "py",
  "right",
  "rounded",
  "rowGap",
  "textAlign",
  "textDecoration",
  "textTransform",
  "top",
  "transform",
  "transition",
  "visibility",
  "w",
  "whiteSpace",
  "width",
  "wordBreak",
  "zIndex",
]);

const unitlessProps = new Set([
  "flex",
  "flexGrow",
  "flexShrink",
  "fontWeight",
  "lineHeight",
  "opacity",
  "zIndex",
]);

const spacingCssProps = new Set([
  "gap",
  "margin",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginTop",
  "padding",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "borderRadius",
  "width",
  "height",
]);

const colorProps = new Set([
  "background",
  "backgroundColor",
  "borderColor",
  "borderBottomColor",
  "color",
]);

const colorMap: Record<string, string> = {
  "blackAlpha.600": "rgba(0,0,0,0.6)",
  "blackAlpha.700": "rgba(0,0,0,0.7)",
  "gray.50": "var(--gray-50)",
  "gray.100": "var(--gray-100)",
  "gray.200": "var(--gray-200)",
  "gray.300": "var(--gray-300)",
  "gray.400": "var(--gray-400)",
  "gray.500": "var(--gray-500)",
  "gray.600": "var(--gray-600)",
  "gray.700": "var(--gray-700)",
  "gray.800": "var(--gray-800)",
  "gray.900": "var(--gray-900)",
  "green.50": "var(--green-50)",
  "green.100": "var(--green-100)",
  "green.200": "var(--green-200)",
  "green.300": "var(--green-300)",
  "green.400": "var(--green-400)",
  "green.500": "var(--green-500)",
  "green.600": "var(--green-600)",
  "green.700": "var(--green-700)",
  "green.800": "var(--green-800)",
  "green.900": "var(--green-900)",
  "orange.900": "#7c2d12",
  "red.400": "#f87171",
  "red.500": "#ef4444",
  "red.600": "#dc2626",
  "red.700": "#b91c1c",
  "red.900": "#7f1d1d",
  "whiteAlpha.100": "rgba(255,255,255,0.06)",
  "whiteAlpha.200": "rgba(255,255,255,0.12)",
  "whiteAlpha.300": "rgba(255,255,255,0.18)",
  "whiteAlpha.500": "rgba(255,255,255,0.36)",
};

const blockedProps = new Set([
  "attached",
  "colorPalette",
  "colorScheme",
  "hasStripe",
  "isAnimated",
  "isAttached",
  "isCentered",
  "isDisabled",
  "isIndeterminate",
  "isInvalid",
  "isLoading",
  "isReadOnly",
  "isRequired",
  "leastDestructiveRef",
  "loading",
  "noOfLines",
  "spacing",
  "variant",
]);

function cx(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function kebab(value: string) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function normalizeResponsiveValue(value: any) {
  if (!value || typeof value !== "object" || Array.isArray(value) || React.isValidElement(value)) {
    return { base: value, responsive: [] as Array<[string, any]> };
  }

  const base = value.base ?? value.sm ?? value.md ?? value.lg ?? value.xl;
  const responsive = Object.entries(value).filter(([key]) => key !== "base");
  return { base, responsive };
}

function normalizeColor(value: any) {
  if (typeof value !== "string") return value;
  return colorMap[value] ?? value;
}

function toCssValue(cssProp: string, value: any) {
  const normalized = colorProps.has(cssProp) ? normalizeColor(value) : value;
  if (typeof normalized !== "number") return normalized;
  if (unitlessProps.has(cssProp)) return String(normalized);
  if (spacingCssProps.has(cssProp)) return `${normalized * 0.25}rem`;
  return `${normalized}px`;
}

function shouldForwardProp(key: string) {
  if (key === "children" || key === "as" || key === "className" || key === "style") return false;
  if (key.startsWith("_") || styleProps.has(key) || blockedProps.has(key)) return false;
  if (key.startsWith("aria-") || key.startsWith("data-") || key.startsWith("on")) return true;
  return [
    "accept",
    "alt",
    "autoComplete",
    "autoFocus",
    "checked",
    "cols",
    "defaultChecked",
    "defaultValue",
    "disabled",
    "form",
    "href",
    "htmlFor",
    "id",
    "inputMode",
    "max",
    "min",
    "multiple",
    "name",
    "pattern",
    "placeholder",
    "readOnly",
    "rel",
    "required",
    "role",
    "rows",
    "src",
    "step",
    "tabIndex",
    "target",
    "title",
    "type",
    "value",
  ].includes(key);
}

function injectCss(className: string, css: string) {
  if (typeof document === "undefined") return;
  const id = `custom-ui-${className}`;
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

function extractProps(props: AnyRecord, defaultStyle?: React.CSSProperties) {
  const domProps: AnyRecord = {};
  const style: React.CSSProperties = { ...(defaultStyle ?? {}) };
  const responsiveRules: string[] = [];

  for (const [key, rawValue] of Object.entries(props)) {
    if (key === "style" || key === "className" || key === "children" || key === "as") continue;

    const cssProps = propAliases[key] ?? (styleProps.has(key) ? [key] : null);
    if (!cssProps) {
      if (shouldForwardProp(key)) domProps[key] = rawValue;
      continue;
    }

    const { base, responsive } = normalizeResponsiveValue(rawValue);
    for (const cssProp of cssProps) {
      if (base !== undefined && base !== null) {
        (style as AnyRecord)[cssProp] = toCssValue(cssProp, base);
      }

      for (const [breakpoint, value] of responsive) {
        const minWidth = breakpoints[breakpoint];
        if (!minWidth || value === undefined || value === null) continue;
        responsiveRules.push(
          `@media (min-width:${minWidth}px){.%CLASS%{${kebab(cssProp)}:${toCssValue(cssProp, value)};}}`
        );
      }
    }
  }

  let responsiveClass = "";
  if (responsiveRules.length) {
    const source = responsiveRules.join("");
    responsiveClass = `cui-${hashString(source)}`;
    injectCss(responsiveClass, source.replace(/%CLASS%/g, responsiveClass));
  }

  return {
    domProps,
    className: responsiveClass,
    style: { ...style, ...(props.style ?? {}) },
  };
}

function createPrimitive<T extends HTMLElement>(
  defaultAs: React.ElementType,
  defaultClassName?: string,
  defaultStyle?: React.CSSProperties
) {
  const Primitive = React.forwardRef<T, CustomProps>(
    ({ as, className, children, ...rest }, ref) => {
      const Element = as ?? defaultAs;
      const extracted = extractProps(rest, defaultStyle);

      return (
        <Element
          ref={ref}
          className={cx(defaultClassName, extracted.className, className)}
          style={extracted.style}
          {...extracted.domProps}
        >
          {children}
        </Element>
      );
    }
  );

  Primitive.displayName = `Custom${typeof defaultAs === "string" ? defaultAs : "Primitive"}`;
  return Primitive;
}

export const Box = createPrimitive<HTMLElement>("div");
export const Container = createPrimitive<HTMLDivElement>("div", "cui-container", {
  width: "100%",
  maxWidth: "1100px",
  marginLeft: "auto",
  marginRight: "auto",
});
export const Flex = createPrimitive<HTMLDivElement>("div", undefined, { display: "flex" });
export const Grid = createPrimitive<HTMLDivElement>("div", undefined, { display: "grid" });
export const GridItem = createPrimitive<HTMLDivElement>("div");
export const Heading = createPrimitive<HTMLHeadingElement>("h2", "cui-heading");
export const Badge = createPrimitive<HTMLSpanElement>("span", "cui-badge");

export const Spinner = React.forwardRef<HTMLSpanElement, CustomProps>(
  ({ className, ...props }, ref) => {
    const extracted = extractProps(props);
    return (
      <span
        ref={ref}
        className={cx("cui-spinner", extracted.className, className)}
        style={extracted.style}
        {...extracted.domProps}
      />
    );
  }
);
Spinner.displayName = "Spinner";

export function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export function Icon({ as: IconComponent, boxSize, size, className, ...props }: CustomProps) {
  const extracted = extractProps({ ...props, boxSize });
  const iconSize = size ?? (typeof boxSize === "number" ? boxSize * 4 : boxSize);
  if (IconComponent) {
    return (
      <IconComponent
        className={cx("cui-icon", extracted.className, className)}
        style={extracted.style}
        size={iconSize}
        {...extracted.domProps}
      />
    );
  }
  return <span className={cx("cui-icon", extracted.className, className)} style={extracted.style} {...extracted.domProps} />;
}

export const Divider = (props: CustomProps) => (
  <Box as="hr" borderColor="gray.700" borderTop="1px solid" width="100%" {...props} />
);

export const useColorModeValue = <T,>(light: T, _dark?: T) => light;

type TextCompatProps = CustomProps & {
  noOfLines?: number;
  isTruncated?: boolean;
};

export const Text = React.forwardRef<HTMLParagraphElement, TextCompatProps>(
  ({ noOfLines, isTruncated, style, ...rest }, ref) => {
    let clampStyle: React.CSSProperties | undefined;

    if (typeof noOfLines === "number" && noOfLines > 0) {
      clampStyle = {
        display: "-webkit-box",
        WebkitLineClamp: noOfLines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      };
    } else if (isTruncated) {
      clampStyle = {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      };
    }

    return (
      <Box
        as="p"
        ref={ref}
        style={{ ...(clampStyle ?? {}), ...(style ?? {}) }}
        {...rest}
      />
    );
  }
);
Text.displayName = "Text";

type InputCompatProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> &
  CustomProps & {
    isDisabled?: boolean;
    isReadOnly?: boolean;
    variant?: "outline" | "filled" | "flushed" | "unstyled" | "subtle";
  };

export const Input = React.forwardRef<HTMLInputElement, InputCompatProps>(
  ({ isDisabled, isReadOnly, disabled, readOnly, className, variant, size: _size, ...rest }, ref) => {
    const extracted = extractProps(rest);
    const inputProps = extracted.domProps as React.InputHTMLAttributes<HTMLInputElement>;
    const resolvedDisabled = isDisabled ?? disabled;
    const resolvedReadOnly = isReadOnly ?? readOnly;
    const resolvedClassName = cx("cui-input", variant ? `cui-input-${variant}` : undefined, extracted.className, className);

    if (inputProps.type === "number") {
      return (
        <NumericInput
          ref={ref}
          className={resolvedClassName}
          disabled={resolvedDisabled}
          readOnly={resolvedReadOnly}
          style={extracted.style}
          {...inputProps}
        />
      );
    }

    return (
      <input
        ref={ref}
        className={resolvedClassName}
        disabled={resolvedDisabled}
        readOnly={resolvedReadOnly}
        style={extracted.style}
        {...inputProps}
      />
    );
  }
);
Input.displayName = "Input";

export const InputGroup = createPrimitive<HTMLDivElement>("div", "cui-input-group", {
  position: "relative",
  display: "flex",
  alignItems: "center",
});

export const InputLeftAddon = createPrimitive<HTMLDivElement>("div", "cui-input-addon cui-input-addon-left");
export const InputRightAddon = createPrimitive<HTMLDivElement>("div", "cui-input-addon cui-input-addon-right");
export const InputLeftElement = createPrimitive<HTMLDivElement>("div", "cui-input-element cui-input-element-left");
export const InputRightElement = createPrimitive<HTMLDivElement>("div", "cui-input-element cui-input-element-right");

type SwitchCompatProps = Omit<React.ComponentProps<"input">, "type" | "onChange"> & {
  isChecked?: boolean;
  isDisabled?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  colorScheme?: string;
};

export const Switch = React.forwardRef<HTMLInputElement, SwitchCompatProps>(
  ({ isChecked, isDisabled, checked, disabled, className, ...rest }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      role="switch"
      checked={isChecked ?? checked}
      disabled={isDisabled ?? disabled}
      className={cx("cui-switch", className)}
      {...rest}
    />
  )
);
Switch.displayName = "Switch";

export function useDisclosure(options?: { defaultOpen?: boolean; onClose?: () => void; onOpen?: () => void }) {
  const [isOpen, setIsOpen] = useState(Boolean(options?.defaultOpen));
  return {
    isOpen,
    open: isOpen,
    onOpen: () => {
      setIsOpen(true);
      options?.onOpen?.();
    },
    onClose: () => {
      setIsOpen(false);
      options?.onClose?.();
    },
    onToggle: () => setIsOpen((current) => !current),
    setOpen: setIsOpen,
  };
}

export function useToast() {
  const ctx = useToastInternal();
  const push = (ctx?.push ?? (() => undefined)) as any;
  push.closeAll = ctx?.closeAll ?? (() => undefined);
  return push as typeof push & { closeAll: () => void };
}

type StackCompatProps = CustomProps & {
  spacing?: React.CSSProperties["gap"];
};

export const Stack = React.forwardRef<HTMLDivElement, StackCompatProps>(
  ({ spacing, gap, ...rest }, ref) => (
    <Box ref={ref} display="flex" flexDirection="column" gap={gap ?? spacing} {...rest} />
  )
);
Stack.displayName = "Stack";

export const HStack = React.forwardRef<HTMLDivElement, StackCompatProps>(
  ({ spacing, gap, ...rest }, ref) => (
    <Box ref={ref} display="flex" flexDirection="row" alignItems="center" gap={gap ?? spacing} {...rest} />
  )
);
HStack.displayName = "HStack";

export const VStack = React.forwardRef<HTMLDivElement, StackCompatProps>(
  ({ spacing, gap, ...rest }, ref) => (
    <Box ref={ref} display="flex" flexDirection="column" gap={gap ?? spacing} {...rest} />
  )
);
VStack.displayName = "VStack";

type ButtonCompatProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  CustomProps & {
    isDisabled?: boolean;
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    colorScheme?: string;
    size?: "xs" | "sm" | "md" | "lg" | string;
    variant?: string;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonCompatProps>(
  (
    {
      isDisabled,
      isLoading,
      leftIcon,
      rightIcon,
      children,
      disabled,
      loading,
      className,
      size = "md",
      variant = "solid",
      type = "button",
      ...rest
    },
    ref
  ) => {
    const extracted = extractProps(rest);
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled ?? disabled ?? isLoading ?? loading}
        className={cx("cui-button", `cui-button-${variant}`, `cui-button-${size}`, extracted.className, className)}
        style={extracted.style}
        {...(extracted.domProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {isLoading || loading ? <span className="cui-spinner cui-spinner-inline" /> : leftIcon}
        <span>{children}</span>
        {rightIcon}
      </button>
    );
  }
);
Button.displayName = "Button";

type IconButtonCompatProps = ButtonCompatProps & {
  icon?: React.ReactNode;
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonCompatProps>(
  ({ icon, children, className, ...rest }, ref) => (
    <Button ref={ref} className={cx("cui-icon-button", className)} {...rest}>
      {children ?? icon}
    </Button>
  )
);
IconButton.displayName = "IconButton";

type ButtonGroupCompatProps = CustomProps & {
  spacing?: React.CSSProperties["gap"];
  isAttached?: boolean;
};

export const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupCompatProps>(
  ({ spacing, gap, isAttached, attached, className, ...rest }, ref) => (
    <Box
      ref={ref}
      display="inline-flex"
      gap={attached ?? isAttached ? 0 : gap ?? spacing}
      className={cx(attached ?? isAttached ? "cui-button-group-attached" : undefined, className)}
      {...rest}
    />
  )
);
ButtonGroup.displayName = "ButtonGroup";

type ListCompatProps = CustomProps & {
  spacing?: React.CSSProperties["gap"];
};

export const List = React.forwardRef<HTMLUListElement, ListCompatProps>(
  ({ spacing, gap, children, ...rest }, ref) => (
    <Box
      as="ul"
      ref={ref}
      display="flex"
      flexDirection="column"
      gap={gap ?? spacing}
      {...rest}
    >
      {children}
    </Box>
  )
);
List.displayName = "List";

export const ListItem = React.forwardRef<HTMLLIElement, CustomProps>(
  (props, ref) => <Box as="li" ref={ref} {...props} />
);
ListItem.displayName = "ListItem";

type TooltipCompatProps = {
  label?: React.ReactNode;
  isDisabled?: boolean;
  children: React.ReactNode;
} & Record<string, unknown>;

export function Tooltip({ label, isDisabled, children }: TooltipCompatProps) {
  if (isDisabled || !label) return <>{children}</>;
  if (React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      title: typeof label === "string" ? label : undefined,
    });
  }
  return <span title={typeof label === "string" ? label : undefined}>{children}</span>;
}

type ProgressCompatProps = CustomProps & {
  value?: number;
  max?: number;
  isIndeterminate?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
};

export function Progress({ value = 0, max = 100, isIndeterminate, size = "sm", className, ...rest }: ProgressCompatProps) {
  const pct = isIndeterminate ? 100 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <Box className={cx("cui-progress", `cui-progress-${size}`, className)} {...rest}>
      <span
        className={cx("cui-progress-bar", isIndeterminate ? "is-indeterminate" : undefined)}
        style={{ width: `${pct}%` }}
      />
    </Box>
  );
}

type AlertCompatProps = CustomProps & {
  status?: "info" | "warning" | "success" | "error";
};

export function Alert({ status = "info", className, children, ...rest }: AlertCompatProps) {
  return (
    <Box role="alert" className={cx("cui-alert", `cui-alert-${status}`, className)} {...rest}>
      {children}
    </Box>
  );
}

export const AlertIcon = (props: CustomProps) => <Box className="cui-alert-icon" {...props} />;
export const AlertTitle = React.forwardRef<HTMLParagraphElement, CustomProps>(
  (props, ref) => <Text ref={ref} fontWeight="bold" {...props} />
);
AlertTitle.displayName = "AlertTitle";
export const AlertDescription = React.forwardRef<HTMLParagraphElement, CustomProps>(
  (props, ref) => <Text ref={ref} opacity={0.9} {...props} />
);
AlertDescription.displayName = "AlertDescription";

type ModalContextValue = { onClose?: () => void };
const ModalContext = createContext<ModalContextValue>({});

type ModalCompatProps = {
  isOpen: boolean;
  onClose: () => void;
  isCentered?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  leastDestructiveRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
};

const modalSizeMap: Record<string, string> = {
  xs: "20rem",
  sm: "24rem",
  md: "28rem",
  lg: "32rem",
  xl: "36rem",
  "2xl": "42rem",
  full: "100%",
};

export function Modal({ isOpen, onClose, isCentered = false, size = "md", children }: ModalCompatProps) {
  if (!isOpen || typeof document === "undefined") return null;
  const maxW = modalSizeMap[size] ?? modalSizeMap.md;

  return createPortal(
    <ModalContext.Provider value={{ onClose }}>
      <div className={cx("cui-modal-root", isCentered ? "is-centered" : undefined)}>
        <div className="cui-modal-slot" style={{ maxWidth: maxW }}>
          {children}
        </div>
      </div>
    </ModalContext.Provider>,
    document.body
  );
}

export const ModalOverlay = (props: CustomProps) => {
  const { onClose } = useContext(ModalContext);
  return <Box className="cui-modal-overlay" onClick={onClose} {...props} />;
};

export const ModalContent = (props: CustomProps) => <Box className="cui-modal-content" {...props} />;
export const ModalHeader = (props: CustomProps) => <Box className="cui-modal-header" {...props} />;
export const ModalBody = (props: CustomProps) => <Box className="cui-modal-body" {...props} />;
export const ModalFooter = (props: CustomProps) => <Box className="cui-modal-footer" {...props} />;
export const ModalCloseButton = (props: CustomProps) => {
  const { onClose } = useContext(ModalContext);
  return <IconButton aria-label="Close" className="cui-modal-close" onClick={onClose} {...props}>x</IconButton>;
};

export const AlertDialog = Modal;
export const AlertDialogOverlay = ModalOverlay;
export const AlertDialogContent = ModalContent;
export const AlertDialogHeader = ModalHeader;
export const AlertDialogBody = ModalBody;
export const AlertDialogFooter = ModalFooter;

type NumberInputContextValue = {
  value: number | string | undefined;
  defaultValue: number | string | undefined;
  onChange: ((valueAsString: string, valueAsNumber: number) => void) | undefined;
  min: number | undefined;
  max: number | undefined;
  step: number | undefined;
};

const NumberInputContext = createContext<NumberInputContextValue>({
  value: undefined,
  defaultValue: undefined,
  onChange: undefined,
  min: undefined,
  max: undefined,
  step: undefined,
});

type NumberInputProps = Omit<CustomProps, "onChange"> & {
  value?: number | string;
  defaultValue?: number | string;
  onChange?: (valueAsString: string, valueAsNumber: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: "xs" | "sm" | "md" | "lg" | string;
};

export function NumberInput({ value, defaultValue, onChange, min, max, step, size, children, ...rest }: NumberInputProps) {
  const ctx = useMemo(
    () => ({ value, defaultValue, onChange, min, max, step }),
    [value, defaultValue, onChange, min, max, step]
  );

  return (
    <NumberInputContext.Provider value={ctx}>
      <Box data-size={size} {...rest}>
        {children}
      </Box>
    </NumberInputContext.Provider>
  );
}

export function NumberInputField(props: InputCompatProps) {
  const ctx = useContext(NumberInputContext);
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    ctx.onChange?.(event.target.value, event.target.valueAsNumber);
    props.onChange?.(event);
  };

  return (
    <Input
      {...props}
      type="number"
      min={ctx.min}
      max={ctx.max}
      step={ctx.step}
      value={ctx.value as any}
      defaultValue={ctx.defaultValue as any}
      onChange={handleChange}
    />
  );
}

export const NumberInputStepper = (_props: { children?: React.ReactNode }) => null;
export const NumberIncrementStepper = (_props: CustomProps) => null;
export const NumberDecrementStepper = (_props: CustomProps) => null;

type SelectCompatProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> &
  CustomProps & {
    size?: "sm" | "md" | "lg" | string;
  };

export const Select = React.forwardRef<HTMLSelectElement, SelectCompatProps>(
  ({ size, className, children, disabled, ...rest }, ref) => {
    const extracted = extractProps(rest);
    const { defaultValue, value, ...domProps } =
      extracted.domProps as React.SelectHTMLAttributes<HTMLSelectElement>;
    const scalarDefaultValue = Array.isArray(defaultValue) ? defaultValue[0] : defaultValue;
    const scalarValue = Array.isArray(value) ? value[0] : value;

    return (
      <UniversalSelect
        ref={ref}
        size={size}
        className={cx("cui-select", extracted.className, className)}
        style={extracted.style}
        disabled={disabled}
        defaultValue={scalarDefaultValue}
        value={scalarValue}
        {...domProps}
      >
        {children}
      </UniversalSelect>
    );
  }
);
Select.displayName = "Select";

type RadioGroupContextValue = {
  name: string | undefined;
  value: string | undefined;
  onChange: ((nextValue: string) => void) | undefined;
  isDisabled: boolean | undefined;
};

const RadioGroupContext = createContext<RadioGroupContextValue>({
  name: undefined,
  value: undefined,
  onChange: undefined,
  isDisabled: undefined,
});

type RadioGroupProps = Omit<CustomProps, "onChange"> & {
  name?: string;
  value?: string;
  onChange?: (nextValue: string) => void;
  isDisabled?: boolean;
};

export function RadioGroup({ name, value, onChange, isDisabled, children, ...rest }: RadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ name, value, onChange, isDisabled }}>
      <Box {...rest}>{children}</Box>
    </RadioGroupContext.Provider>
  );
}

type RadioCompatProps = CustomProps & {
  value?: string;
  isDisabled?: boolean;
  size?: "sm" | "md" | "lg" | string;
  colorScheme?: string;
};

export function Radio({ value, isDisabled, children, className, ...rest }: RadioCompatProps) {
  const ctx = useContext(RadioGroupContext);
  const checked = ctx.value === value;
  const disabled = ctx.isDisabled ?? isDisabled;

  return (
    <Box as="label" className={cx("cui-radio", className)} {...rest}>
      <input
        type="radio"
        name={ctx.name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={(event) => ctx.onChange?.(event.target.value)}
      />
      {children}
    </Box>
  );
}

type FormControlCompatProps = CustomProps & {
  isInvalid?: boolean;
  isRequired?: boolean;
  isDisabled?: boolean;
};

export const FormControl = React.forwardRef<HTMLDivElement, FormControlCompatProps>((props, ref) => (
  <Box ref={ref} {...props} />
));
FormControl.displayName = "FormControl";

export const FormLabel = React.forwardRef<HTMLLabelElement, CustomProps>(
  (props, ref) => <Box as="label" ref={ref} fontWeight="medium" mb={1} display="block" {...props} />
);
FormLabel.displayName = "FormLabel";

export const FormHelperText = React.forwardRef<HTMLParagraphElement, CustomProps>(
  (props, ref) => <Text ref={ref} fontSize="sm" opacity={0.7} {...props} />
);
FormHelperText.displayName = "FormHelperText";

export type InputGroupProps = CustomProps;
export type InputProps = InputCompatProps;
