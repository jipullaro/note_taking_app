"use client";

import { useEffect } from "react";

/**
 * A one-event bus for "the set of notes changed".
 *
 * The sidebar refetches its counts in an effect keyed on `pathname`, which
 * covers navigating back to the dashboard but not acting in place — restoring
 * from /archive leaves you on /archive, so the archived count would sit stale
 * until you navigated somewhere. `router.refresh()` doesn't help: it
 * re-renders server components but preserves client state, and the sidebar
 * holds its counts in `useState`.
 *
 * A window event is the smallest thing that closes that gap without hoisting
 * counts into a context or pulling in a store.
 */
export const NOTES_CHANGED_EVENT = "notes:changed";

export function emitNotesChanged(): void {
  window.dispatchEvent(new Event(NOTES_CHANGED_EVENT));
}

export function useNotesChanged(handler: () => void): void {
  useEffect(() => {
    window.addEventListener(NOTES_CHANGED_EVENT, handler);
    return () => window.removeEventListener(NOTES_CHANGED_EVENT, handler);
  });
}
