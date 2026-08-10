export type ToastOptions = {
  title?: string;
  description?: string;
  status?: "info" | "success" | "warning" | "error";
  duration?: number;
};

export function toastError(title: string, err: unknown): ToastOptions {
  const description =
    err instanceof Error
      ? err.message
      : typeof err === "string"
      ? err
      : "Unknown error";

  return {
    title,
    description,
    status: "error",
    duration: 6000,
  };
}

