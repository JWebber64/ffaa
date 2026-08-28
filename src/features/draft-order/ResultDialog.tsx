import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "../../ui/Button";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "summary",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function ResultDialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])]
        .filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="showdown-result-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="showdown-result-dialog" role="dialog" aria-modal="true" aria-labelledby="showdown-results-title">
        <header className="showdown-result-dialog-bar">
          <div><span>Showdown complete</span><strong>Official draft order</strong></div>
          <Button ref={closeRef} size="sm" variant="ghost" onClick={onClose} aria-label="Close draft order popup"><X size={18} aria-hidden="true" /></Button>
        </header>
        <div className="showdown-result-dialog-scroll">{children}</div>
      </div>
    </div>
  );
}
