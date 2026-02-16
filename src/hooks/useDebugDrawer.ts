import { useEffect, useState } from "react";

type DebugDrawerState = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

export function useDebugDrawerState(): DebugDrawerState {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen((v) => !v);

  // Shortcut: Ctrl+Shift+D (or Cmd+Shift+D on Mac)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key?.toLowerCase?.() ?? "";
      const meta = e.metaKey;
      const ctrl = e.ctrlKey;
      const shift = e.shiftKey;

      if ((ctrl || meta) && shift && key === "d") {
        e.preventDefault();
        toggle();
      }
      if (key === "escape") close();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return { isOpen, open, close, toggle };
}
