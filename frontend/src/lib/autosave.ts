"use client";

import { useEffect, useRef, useState } from "react";

/** How long to wait for typing to settle before saving. */
export const AUTOSAVE_DELAY_MS = 800;

/**
 * Ceiling on that wait. A trailing debounce on its own only fires once the
 * user pauses, so someone typing without a gap could go minutes with nothing
 * on the server; this bounds how far ahead of the last save the editor can
 * get. It's a ceiling and not a second schedule — the debounce still wins
 * whenever the user pauses first.
 */
export const AUTOSAVE_MAX_WAIT_MS = 5_000;

/** Backoff between attempts after a save fails; the last entry repeats. */
const RETRY_DELAYS_MS = [1_000, 3_000, 10_000, 30_000];

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface Autosave {
  status: SaveStatus;
  /** Mark the content changed; save it once typing settles. */
  schedule: () => void;
  /** Save what's pending now, resolving when it has landed (or failed). */
  flush: () => Promise<void>;
  /** Drop pending work without saving it — for when the note is going away. */
  cancel: () => void;
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * Debounced, single-flight autosave.
 *
 * `save` is called with the fetch options it should forward (currently just
 * `keepalive`, which the exit flush needs so a request survives the page
 * going away). It should throw to report failure; retries and the status
 * shown to the user are handled here.
 *
 * The two rules that matter:
 *
 *   - **One request at a time.** Overlapping saves are how a brand-new note
 *     gets POSTed twice, and how an older body lands after a newer one.
 *     Anything typed while a request is out is picked up by a follow-up save
 *     once it settles, never by a second concurrent one.
 *   - **A change is never dropped.** The dirty flag is cleared before the
 *     request rather than after, so edits made mid-request re-dirty it; a
 *     failure hands the change back and the backoff picks it up.
 */
export function useAutosave(save: (init: { keepalive: boolean }) => Promise<void>): Autosave {
  const [status, setStatus] = useState<SaveStatus>("idle");

  const saveRef = useRef(save);
  const dirtyRef = useRef(false);
  const debounceRef = useRef<Timer | null>(null);
  const ceilingRef = useRef<Timer | null>(null);
  const retryRef = useRef<Timer | null>(null);
  const failuresRef = useRef(0);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const goneRef = useRef(false);

  // Kept current so a timer that fires later saves the latest content rather
  // than whatever was on screen when it was scheduled.
  useEffect(() => {
    saveRef.current = save;
  });

  function clearTimer(ref: { current: Timer | null }) {
    if (ref.current !== null) {
      clearTimeout(ref.current);
      ref.current = null;
    }
  }

  function clearTimers() {
    clearTimer(debounceRef);
    clearTimer(ceilingRef);
    clearTimer(retryRef);
  }

  function run(keepalive = false): Promise<void> {
    clearTimers();
    if (inFlightRef.current !== null) return inFlightRef.current;
    if (!dirtyRef.current) return Promise.resolve();

    dirtyRef.current = false;
    setStatus("saving");

    let failed = false;
    const attempt = saveRef
      .current({ keepalive })
      .then(() => {
        failuresRef.current = 0;
      })
      .catch(() => {
        failed = true;
        failuresRef.current += 1;
        dirtyRef.current = true; // hand the change back to the retry
      })
      .finally(() => {
        inFlightRef.current = null;
        if (failed) {
          setStatus("error");
          // Nothing to retry into once the editor is gone — the draft has the
          // content, and the next visit picks it up.
          if (!goneRef.current) {
            const delay =
              RETRY_DELAYS_MS[Math.min(failuresRef.current - 1, RETRY_DELAYS_MS.length - 1)];
            retryRef.current = setTimeout(() => void run(), delay);
          }
        } else if (dirtyRef.current) {
          void run(keepalive); // edits that landed while this request was out
        } else {
          setStatus("saved");
        }
      });

    inFlightRef.current = attempt;
    return attempt;
  }

  function schedule(): void {
    dirtyRef.current = true;
    clearTimer(retryRef); // the debounce below now owns the next attempt
    clearTimer(debounceRef);
    debounceRef.current = setTimeout(() => void run(), AUTOSAVE_DELAY_MS);
    // Started once and left to run: restarting it alongside the debounce
    // would make it a second debounce and never cap anything.
    if (ceilingRef.current === null) {
      ceilingRef.current = setTimeout(() => void run(), AUTOSAVE_MAX_WAIT_MS);
    }
  }

  async function flush(keepalive = false): Promise<void> {
    clearTimers();
    // Wait out a request that's already going, then save whatever it didn't
    // cover. `attempt` never rejects, so this can't throw at its caller —
    // closing the note must not depend on the network.
    while (inFlightRef.current !== null) await inFlightRef.current;
    if (dirtyRef.current) await run(keepalive);
    // A save can queue one follow-up from its own completion handler.
    while (inFlightRef.current !== null) await inFlightRef.current;
  }

  function cancel(): void {
    clearTimers();
    dirtyRef.current = false;
  }

  // Re-subscribed every render (like useNotesChanged in lib/events) so these
  // handlers always close over the current `flush`.
  useEffect(() => {
    function onHide() {
      // visibilitychange is the one exit signal that fires reliably on mobile
      // and on tab close; `beforeunload` doesn't. Nothing can be awaited here,
      // which is what `keepalive` is for.
      if (document.visibilityState === "hidden") void flush(true);
    }
    function onPageHide() {
      void flush(true);
    }
    function onOnline() {
      if (dirtyRef.current) void run();
    }

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("online", onOnline);
    };
  });

  useEffect(() => {
    goneRef.current = false; // this hook can be mounted again (React strict mode does exactly that)
    return () => {
      goneRef.current = true;
      clearTimer(debounceRef);
      clearTimer(ceilingRef);
      clearTimer(retryRef);
      // The editor can be navigated away from without anyone calling flush()
      // — a sidebar link, the browser's back button — and the timers above
      // have just been cancelled. Send what's pending instead of leaving it
      // for the draft to recover, or the dashboard shows a stale note until
      // the user next opens it. `keepalive` because the page may be leaving
      // too. Anything in flight is already on its way and finishes on its own.
      if (dirtyRef.current) void run(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on mount/unmount; `run` reads everything through refs
  }, []);

  return { status, schedule, flush, cancel };
}
