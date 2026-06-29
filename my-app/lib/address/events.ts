/**
 * The header owns the address editor modal. Other parts of the app (e.g. the
 * browse empty state) ask it to open via this decoupled window event instead of
 * threading a callback through context.
 */
export const OPEN_ADDRESS_EVENT = "7eats:open-address";

/** Ask the shell header to open the address editor. */
export function openAddressEditor(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_ADDRESS_EVENT));
}
