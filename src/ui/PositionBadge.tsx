import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";
import { positionClassName, positionColorKey, positionColorVar } from "./positionColors";

type PositionBadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  children?: ReactNode;
  position: string;
};

export function PositionBadge({ children, className, position, style, ...props }: PositionBadgeProps) {
  const colorKey = positionColorKey(position);
  const color = positionColorVar(position);

  return (
    <span
      {...props}
      className={cn("ffaa-position-badge", positionClassName(position), className)}
      data-position-color={colorKey ?? "bench"}
      style={{
        ...style,
        "--position-color": color,
        backgroundColor: color,
        color: "var(--position-foreground, var(--pos-foreground-light))",
      } as CSSProperties}
    >
      {children ?? position}
    </span>
  );
}
