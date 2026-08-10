"use client";

/**
 * Transient messages, shown by the <Toaster /> mounted in the app layout.
 *
 * A window event rather than a context, for the same reason as
 * src/lib/events.ts: the emitters are scattered across the sidebar, the
 * editor and the note cards, and a provider would have to wrap server
 * components to reach them. `showToast` is a plain function, so it can be
 * called from anywhere — including a catch block, which is most of its use.
 *
 * The single subscriber is <Toaster />; nothing else should listen.
 */
export const TOAST_EVENT = "toast:show";

export type ToastVariant = "success" | "error";

export type ToastRequest = {
  message: string;
  variant: ToastVariant;
};

export type Toast = ToastRequest & { id: number };

/**
 * How long a toast stays up. Errors linger: they carry a message the user has
 * to read and often act on, while a success is a glance-and-forget receipt for
 * something they just did on purpose.
 */
export const TOAST_DURATION_MS: Record<ToastVariant, number> = {
  success: 4000,
  error: 7000,
};

export function showToast(message: string, variant: ToastVariant = "success"): void {
  window.dispatchEvent(
    new CustomEvent<ToastRequest>(TOAST_EVENT, { detail: { message, variant } })
  );
}

/** Sugar for the common `catch` shape — see apiErrorMessage in lib/api.ts. */
export function showErrorToast(message: string): void {
  showToast(message, "error");
}
