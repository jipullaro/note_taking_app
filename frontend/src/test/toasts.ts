import { afterEach, beforeEach } from "vitest";

import { TOAST_EVENT, type ToastRequest } from "@/lib/toast";

/**
 * Collects toasts raised during each test in the enclosing describe. Call it
 * in the describe body, not inside an `it` — it registers hooks.
 *
 * Components are rendered without the <Toaster /> here — it's mounted in the
 * app layout, not by each component — so the raised event has no subscriber.
 * Listening for it directly is what asserting "the user was told" looks like
 * at this level; the Toaster's own rendering is covered in Toaster.test.tsx.
 *
 * The returned array is emptied in place between tests, so it stays the same
 * reference the caller closed over.
 */
export function captureToasts(): ToastRequest[] {
  const toasts: ToastRequest[] = [];
  const listener = (event: Event) => {
    toasts.push((event as CustomEvent<ToastRequest>).detail);
  };

  beforeEach(() => {
    toasts.length = 0;
    window.addEventListener(TOAST_EVENT, listener);
  });
  afterEach(() => window.removeEventListener(TOAST_EVENT, listener));

  return toasts;
}
