"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal confirmation for destructive actions, replacing window.confirm().
 *
 * The native dialog can't be styled, is suppressed by some browsers, and
 * blocks the whole tab while it's up. This renders in-app instead — into a
 * portal on <body>, so a card's `overflow`/stacking context can't clip or
 * bury it — and keeps the three behaviours users expect of the native one:
 * Escape cancels, a click on the backdrop cancels, and focus goes into the
 * dialog (and back where it came from afterwards).
 *
 * Controlled: the caller owns `open` and both outcomes, so the confirm can
 * stay up with `busy` set while the request it triggered is in flight.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busyLabel,
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  /** Shown on the confirm button while `busy`; defaults to `confirmLabel`. */
  busyLabel?: string;
  cancelLabel?: string;
  /** Disables both buttons and blocks Escape/backdrop cancels. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Cancel is what gets focus, not confirm: this dialog exists to slow a
  // destructive action down, so a stray Enter must not carry it out.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    return () => {
      // The trigger is often gone by now (the card unmounts, the editor
      // navigates away); focusing a detached node is a no-op, not an error.
      previouslyFocused?.focus?.();
    };
  }, [open]);

  // Escape to cancel, and Tab kept inside the panel — a modal that leaks
  // focus to the page behind it is only visually modal.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (busy) return; // the request is already out; nothing to back out of
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, busy, onCancel]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      // mousedown, not click: a click that started inside the panel and ended
      // on the backdrop (a drag over the text) would otherwise cancel.
      onMouseDown={(event) => {
        if (busy) return;
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="w-full max-w-sm rounded-2xl border border-ink/10 bg-cream p-6 shadow-xl"
      >
        <h2 id={titleId} className="font-serif text-lg font-bold text-ink">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-2 text-sm text-ink/70">
            {description}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={cn(
              "cursor-pointer rounded-full border border-ink/20 bg-cream px-5 py-2 text-sm font-semibold text-ink",
              "hover:bg-ink/5 active:bg-ink/10 disabled:cursor-default disabled:opacity-50"
            )}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className={cn(
              // Filled red rather than the accent pill used everywhere else:
              // the one button on screen that destroys something should not
              // look like the one that saves.
              "cursor-pointer rounded-full border border-red-800 bg-red-700 px-5 py-2 text-sm font-semibold text-cream",
              "hover:bg-red-800 active:bg-red-900 disabled:cursor-default disabled:opacity-50"
            )}
          >
            {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
