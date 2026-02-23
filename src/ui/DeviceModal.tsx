import React, { useEffect, useRef } from "react";
import { cn } from "./cn";
import { Button } from "./Button";

type Preset = "iphone" | "pixel" | "ipad";

const PRESETS: Record<Preset, { w: number; h: number; r: number; bezel: number }> = {
  // Logical CSS pixels (roughly matches common device viewports)
  iphone: { w: 390, h: 844, r: 44, bezel: 10 },
  pixel: { w: 412, h: 915, r: 36, bezel: 10 },
  ipad: { w: 820, h: 1180, r: 28, bezel: 10 },
};

export function DeviceModal({
  open,
  title,
  subtitle,
  preset = "iphone",
  zoom = 1,
  children,
  onClose,
  activeHint,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  preset?: Preset;
  zoom?: number;
  children: React.ReactNode;
  onClose: () => void;
  /** Optional hint text rendered in the top chrome (e.g. "Draft live") */
  activeHint?: string;
}) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) closeBtnRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const p = PRESETS[preset];
  const outerW = Math.round(p.w * zoom);
  const outerH = Math.round(p.h * zoom);

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          className={cn(
            "relative",
            "rounded-[48px]",
            "border border-[rgba(255,255,255,0.14)]",
            "shadow-[0_40px_120px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.08)]",
            "bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]",
            "backdrop-blur-xl"
          )}
          style={{ width: outerW + p.bezel * 2, height: outerH + p.bezel * 2, padding: p.bezel }}
          aria-modal="true"
          role="dialog"
        >
          {/* Notch / top chrome */}
          <div
            className={cn(
              "absolute left-1/2 -translate-x-1/2 top-[10px]",
              "h-[22px] w-[160px] rounded-[999px]",
              "bg-[rgba(0,0,0,0.55)]",
              "border border-[rgba(255,255,255,0.08)]",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            )}
          />

          {/* Close button */}
          <div className="absolute right-[14px] top-[14px] z-[3]">
            <Button ref={closeBtnRef} variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>

          {/* Device screen */}
          <div
            className={cn(
              "relative",
              "h-full w-full",
              "overflow-hidden",
              "bg-[rgba(8,10,14,0.95)]",
              "border border-[rgba(255,255,255,0.10)]",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            )}
            style={{ borderRadius: p.r }}
          >
            {/* Top status/header inside screen */}
            <div className="sticky top-0 z-[2]">
              <div className="px-3 pt-8 pb-2 border-b border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] backdrop-blur-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-fg0 truncate">{title}</div>
                    {subtitle ? <div className="mt-0.5 text-[11px] text-fg2 truncate">{subtitle}</div> : null}
                  </div>
                  {activeHint ? (
                    <div className="text-[10px] text-fg2 rounded-[999px] border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-2 py-0.5">
                      {activeHint}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Scrollable app area */}
            <div className="h-full w-full overflow-auto" style={{ paddingBottom: 18 }}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
