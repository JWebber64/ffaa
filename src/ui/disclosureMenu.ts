export function closeParentDisclosure(element: Element) {
  const details = element.closest("details");
  if (details instanceof HTMLDetailsElement) details.open = false;
}
