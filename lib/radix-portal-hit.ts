/**
 * True when an outside-dismiss event originated from content rendered in a
 * Radix portal (Select, DropdownMenu, Popover, Tooltip, …) or from the POS
 * on-screen keyboard. Dialog / Sheet layers must not treat these as "outside"
 * or they can close while the portal unmounts and trigger React DOM errors
 * ("removeChild: The node to be removed is not a child of this node").
 */

/** Radix DismissableLayer puts the real click target on detail.originalEvent. */
export function radixOutsideEventTarget(
  event: {
    target?: EventTarget | null;
    detail?: { originalEvent?: Event };
  }
): EventTarget | null {
  return event.detail?.originalEvent?.target ?? event.target ?? null;
}

export function isRadixPortaledLayerTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("[data-radix-popper-content-wrapper]") ||
      target.closest('[role="listbox"]') ||
      target.closest('[role="menu"]') ||
      target.closest("[data-radix-tooltip-content]") ||
      target.closest("[data-radix-popover-content]") ||
      target.closest("[data-pos-osk]")
  );
}

export function shouldIgnoreRadixOutsideDismiss(event: {
  target?: EventTarget | null;
  detail?: { originalEvent?: Event };
}): boolean {
  return isRadixPortaledLayerTarget(radixOutsideEventTarget(event));
}
