import React, { createContext, useContext, useState } from "react";
import { cn } from "./cn";

type Toast = {
  id: string;
  message: string;
};

const ToastCtx = createContext<any>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function push(message: string) {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3000);
  }

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}

      <div className="fixed bottom-6 right-6 space-y-2 z-[100]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-lg border border-[rgba(124,58,237,0.35)]",
              "bg-[rgba(10,14,24,0.9)] backdrop-blur p-3",
              "shadow-s2 text-sm text-fg0",
              "animate-[fadeIn_200ms_ease]"
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
