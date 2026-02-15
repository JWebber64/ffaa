import type { UseToastOptions } from "@chakra-ui/react";

export function toastError(title: string, err: unknown): UseToastOptions {
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
    isClosable: true,
    position: "top",
  };
}
