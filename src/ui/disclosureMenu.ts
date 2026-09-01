import { useEffect, type RefObject } from "react";

export function closeParentDisclosure(element: Element) {
  const details = element.closest("details");
  if (details instanceof HTMLDetailsElement) details.open = false;
}

function getOpenDisclosures(container: HTMLElement) {
  const openDisclosures = Array.from(
    container.querySelectorAll<HTMLDetailsElement>("details[open]")
  );

  if (container instanceof HTMLDetailsElement && container.open) {
    openDisclosures.unshift(container);
  }

  return openDisclosures;
}

export function useDismissibleDisclosureMenus(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const container = containerRef.current;
      const target = event.target;
      if (!container || !(target instanceof Node)) return;

      for (const disclosure of getOpenDisclosures(container)) {
        if (!disclosure.contains(target)) disclosure.open = false;
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      const container = containerRef.current;
      if (!container) return;

      const openDisclosures = getOpenDisclosures(container);
      if (!openDisclosures.length) return;

      const activeElement = document.activeElement;
      const activeDisclosure = activeElement instanceof Node
        ? openDisclosures.find((disclosure) => disclosure.contains(activeElement))
        : undefined;

      for (const disclosure of openDisclosures) disclosure.open = false;

      const summary = (activeDisclosure ?? openDisclosures[0])?.firstElementChild;
      if (summary instanceof HTMLElement && summary.tagName === "SUMMARY") summary.focus();
      event.stopPropagation();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [containerRef]);
}
