// Topmost-modal coordination for window-level keyboard handlers.
//
// The app layers several independent overlays (QuickLook z1000, SettingsModal
// z2000, ConfirmDialog z5000) that each own global keydown listeners. Without
// coordination a keypress acts on every open layer at once (e.g. Space both
// confirming a delete dialog and closing QuickLook underneath). Each overlay
// registers itself here on mount/open and pops on unmount/close; handlers skip
// their logic unless they are the top of the stack, which mirrors visual
// z-order as long as every layer participates.

const stack: string[] = [];

/** Register an open modal. Re-registering the same id moves it to the top. */
export function pushModal(id: string): void {
  const i = stack.indexOf(id);
  if (i !== -1) stack.splice(i, 1);
  stack.push(id);
}

/** Unregister a closed modal (no-op if already removed). */
export function popModal(id: string): void {
  const i = stack.indexOf(id);
  if (i !== -1) stack.splice(i, 1);
}

/** True when `id` is the visually topmost registered modal. */
export function isTopmostModal(id: string): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id;
}

/** True while any modal is open — base-layer (gallery) handlers gate on this. */
export function hasOpenModals(): boolean {
  return stack.length > 0;
}
