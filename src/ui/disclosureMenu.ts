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

function fitMenuPanels(container: HTMLElement) {
  const viewport = window.visualViewport;
  const leftEdge = (viewport?.offsetLeft ?? 0) + 12;
  const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 24;
  const header = document.querySelector<HTMLElement>(".app-header");
  const topEdge = Math.max((viewport?.offsetTop ?? 0) + 12, (header?.getBoundingClientRect().bottom ?? 0) + 8);
  const mobileNav = document.querySelector<HTMLElement>(".product-mobile-nav");
  const bottomEdge = Math.min(
    (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight),
    mobileNav?.getClientRects().length ? mobileNav.getBoundingClientRect().top : Infinity,
  ) - 12;

  for (const disclosure of getOpenDisclosures(container)) {
    const panel = disclosure.querySelector<HTMLElement>(":scope > [data-viewport-menu]");
    const summary = disclosure.querySelector("summary");
    if (!panel || !summary) continue;
    panel.style.translate = "";
    panel.style.maxHeight = "";
    const anchor = summary.getBoundingClientRect();
    const below = Math.max(0, bottomEdge - anchor.bottom - 8);
    const above = Math.max(0, anchor.top - topEdge - 8);
    const available = Math.max(0, bottomEdge - topEdge);
    const opensBelow = panel.scrollHeight <= below || below >= above;
    panel.style.maxHeight = `${Math.min(available, opensBelow ? below : above)}px`;
    const box = panel.getBoundingClientRect();
    const left = Math.max(leftEdge, Math.min(box.left, rightEdge - box.width));
    const preferredTop = opensBelow ? anchor.bottom + 8 : anchor.top - box.height - 8;
    const top = Math.max(topEdge, Math.min(preferredTop, bottomEdge - box.height));
    panel.style.translate = `${left - box.left}px ${top - box.top}px`;
  }
}

export function useDismissibleDisclosureMenus(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    function fitOpenMenus() {
      if (containerRef.current) fitMenuPanels(containerRef.current);
    }

    function handleToggle(event: Event) {
      if (event.target instanceof HTMLDetailsElement && event.target.open && containerRef.current?.contains(event.target)) fitOpenMenus();
    }

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
    document.addEventListener("toggle", handleToggle, true);
    window.addEventListener("resize", fitOpenMenus);
    window.addEventListener("scroll", fitOpenMenus);
    window.visualViewport?.addEventListener("resize", fitOpenMenus);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("toggle", handleToggle, true);
      window.removeEventListener("resize", fitOpenMenus);
      window.removeEventListener("scroll", fitOpenMenus);
      window.visualViewport?.removeEventListener("resize", fitOpenMenus);
    };
  }, [containerRef]);
}
