"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/ui/icons";
import {
  TOAST_DURATION_MS,
  TOAST_EVENT,
  type Toast,
  type ToastRequest,
} from "@/lib/toast";

/**
 * Cap on what's on screen at once. Without one, a user holding down a button
 * against a failing API would push the stack past the top of the viewport;
 * the oldest is the least relevant, so it's what gets dropped.
 */
const MAX_VISIBLE = 3;

/**
 * The one subscriber to the toast event. Mounted in the app layout, so there
 * is exactly one per page — a second instance would double every message.
 */
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Monotonic, not Date.now(): two toasts raised in the same tick would
  // collide on a timestamp and React would warn about duplicate keys.
  const nextId = useRef(0);
  // Kept so unmounting clears pending dismissals instead of calling setState
  // on a gone component.
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    function handle(event: Event) {
      const { message, variant } = (event as CustomEvent<ToastRequest>).detail;
      const id = nextId.current++;

      setToasts((prev) => [...prev, { id, message, variant }].slice(-MAX_VISIBLE));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_DURATION_MS[variant])
      );
    }

    window.addEventListener(TOAST_EVENT, handle);
    return () => window.removeEventListener(TOAST_EVENT, handle);
  }, [dismiss]);

  // Unmounting with toasts still up would leave their dismiss timers pending.
  // The Map is read here rather than in the cleanup closure so the cleanup
  // doesn't touch the ref after React has torn the component down.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  return (
    /*
     * The container is always mounted, empty or not: a live region has to
     * exist before content lands in it for a screen reader to announce the
     * insertion. `pointer-events-none` keeps the fixed overlay from eating
     * clicks on the page underneath — the toasts themselves opt back in.
     */
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex w-[min(24rem,calc(100vw-3rem))] -translate-x-1/2 flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          // status is polite, alert is assertive: an error interrupts, a
          // success waits its turn.
          role={toast.variant === "error" ? "alert" : "status"}
          className={`toast-item pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
            toast.variant === "error"
              ? "border-red-700/25 bg-red-50 text-red-800"
              : "border-ink/15 bg-cream text-ink"
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
            className="-mr-1 cursor-pointer rounded p-1 opacity-60 hover:opacity-100"
          >
            <CloseIcon className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
