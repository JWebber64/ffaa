import { createContext, useContext } from "react";

export type ToastInput =
  | string
  | {
      title?: string;
      description?: string;
      status?: "info" | "success" | "warning" | "error";
      duration?: number;
    };

export type ToastApi = {
  push: (input: ToastInput) => void;
  closeAll: () => void;
};

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast() {
  return useContext(ToastContext);
}
