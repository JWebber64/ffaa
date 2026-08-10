import React from "react";
import { cn } from "./cn";

type CardVariant = "glass" | "control";

export function Card({
  variant = "glass",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return (
    <div
      className={cn(
        variant === "control" ? "control-card-surface" : "liquid-card rounded-[20px]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-4 pt-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-4 pb-4 pt-3", className)} {...props}>
      {children}
    </div>
  );
}
