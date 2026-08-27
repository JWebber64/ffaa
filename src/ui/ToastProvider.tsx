import React, { useState } from "react";
import { cn } from "./cn";
import { ToastContext, type ToastInput } from "./toastContext";

type Toast = {
  id: string;
  title: string | undefined;
  description: string | undefined;
  status: "info" | "success" | "warning" | "error";
  duration: number;
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function push(input: ToastInput) {
    const id = crypto.randomUUID();
    const normalized =
      typeof input === "string"
        ? { title: input, description: undefined, status: "info" as const, duration: 3000 }
        : {
            title: input.title,
            description: input.description,
            status: input.status ?? "info",
            duration: input.duration ?? 3000,
          };

    const toast: Toast = { id, ...normalized };
    setToasts((t) => [...t, toast]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, normalized.duration);
  }

  function closeAll() {
    setToasts([]);
  }

  return (
    <ToastContext.Provider value={{ push, closeAll }}>
      {children}

      <div className="fixed bottom-6 right-6 space-y-2 z-[100]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-lg border border-[rgba(124,58,237,0.35)]",
              "bg-[var(--color-surface-overlay)] backdrop-blur p-3",
              "shadow-s2 text-sm text-fg0",
              "animate-[fadeIn_200ms_ease]"
            )}
          >
            <div className="text-xs uppercase tracking-wide opacity-70">{t.status}</div>
            {t.title ? <div className="font-medium">{t.title}</div> : null}
            {t.description ? <div className="text-xs opacity-80 mt-1">{t.description}</div> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
