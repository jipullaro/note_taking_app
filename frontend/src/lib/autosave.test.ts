import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTOSAVE_DELAY_MS, AUTOSAVE_MAX_WAIT_MS, useAutosave } from "./autosave";

/** A promise whose settlement the test controls, to hold a save "in flight". */
function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Renders the re-renders that a save's completion queued.
 *
 * React schedules its own work on a timer, so under a fake clock it doesn't
 * run just because the promise it was waiting on settled — without this the
 * hook's `status` lags a step behind what it has actually done. An empty act
 * scope flushes React's queue synchronously, which is exactly what's wanted.
 */
async function flushReact() {
  await act(async () => {});
}

/** Advances timers and lets the promise chains they start settle. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  await flushReact();
}

/** Lets pending microtasks (a settled save's follow-up) run without a timer. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await flushReact();
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useAutosave scheduling", () => {
  it("waits for typing to settle instead of saving on every change", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave(save));

    act(() => {
      result.current.schedule();
      result.current.schedule();
      result.current.schedule();
    });
    await advance(AUTOSAVE_DELAY_MS - 100);
    expect(save).not.toHaveBeenCalled();

    await advance(100);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("saves anyway once the ceiling is hit, however long the typing runs", async () => {
    // The bug this exists for: a plain trailing debounce only fires on a
    // pause, so typing with no gap saves nothing at all.
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave(save));

    const keystroke = AUTOSAVE_DELAY_MS - 100;
    for (let elapsed = 0; elapsed < AUTOSAVE_MAX_WAIT_MS * 2; elapsed += keystroke) {
      act(() => result.current.schedule());
      await advance(keystroke);
    }

    expect(save).toHaveBeenCalled();
  });

  it("reports what it's doing", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave(save));
    expect(result.current.status).toBe("idle");

    act(() => result.current.schedule());
    await advance(AUTOSAVE_DELAY_MS);
    expect(result.current.status).toBe("saved");
  });

  it("drops pending work on cancel", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave(save));

    act(() => result.current.schedule());
    act(() => result.current.cancel());
    await advance(AUTOSAVE_MAX_WAIT_MS * 2);

    expect(save).not.toHaveBeenCalled();
  });

  it("sends pending work on the way out rather than firing timers later", async () => {
    // Leaving the editor by a link or the back button never calls flush(), so
    // without this the edit sits in the draft and the dashboard shows the old
    // note until the user opens it again.
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useAutosave(save));

    act(() => result.current.schedule());
    unmount();
    expect(save).toHaveBeenCalledWith({ keepalive: true });

    await advance(AUTOSAVE_MAX_WAIT_MS * 2);
    expect(save).toHaveBeenCalledTimes(1); // no timer outlived the editor
  });

  it("takes nothing with it when there was nothing pending", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() => useAutosave(save));

    unmount();
    await advance(AUTOSAVE_MAX_WAIT_MS * 2);

    expect(save).not.toHaveBeenCalled();
  });

  it("stops retrying once the editor is gone", async () => {
    const save = vi.fn().mockRejectedValue(new Error("offline"));
    const { result, unmount } = renderHook(() => useAutosave(save));

    act(() => result.current.schedule());
    unmount();
    await settle();
    expect(save).toHaveBeenCalledTimes(1);

    // Nothing left to retry into; the draft is what recovers this.
    await advance(60_000);
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe("useAutosave concurrency", () => {
  it("never has two saves in flight at once", async () => {
    // Overlapping saves are how a new note gets POSTed twice and how an older
    // body lands after a newer one.
    const first = deferred();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave(save));

    act(() => result.current.schedule());
    await advance(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);

    // Everything that could start a second one, while the first is still out.
    act(() => result.current.schedule());
    void result.current.flush();
    await advance(AUTOSAVE_MAX_WAIT_MS * 2);
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve();
    });
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("picks up edits made while a save was in flight", async () => {
    const first = deferred();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave(save));

    act(() => result.current.schedule());
    await advance(AUTOSAVE_DELAY_MS);
    act(() => result.current.schedule()); // typed during the request

    await act(async () => {
      first.resolve();
    });
    await settle();

    // The follow-up runs off the back of the first, not off a fresh debounce.
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("saved");
  });
});

describe("useAutosave failures", () => {
  it("says so and retries rather than dropping the change", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave(save));

    act(() => result.current.schedule());
    await advance(AUTOSAVE_DELAY_MS);
    expect(result.current.status).toBe("error");
    expect(save).toHaveBeenCalledTimes(1);

    await advance(1_000); // first backoff step
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("saved");
  });

  it("backs off instead of hammering a failing endpoint", async () => {
    const save = vi.fn().mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useAutosave(save));

    act(() => result.current.schedule());
    await advance(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);

    await advance(1_000);
    expect(save).toHaveBeenCalledTimes(2);

    // Second step is 3s, so a further second buys nothing.
    await advance(1_000);
    expect(save).toHaveBeenCalledTimes(2);

    await advance(2_000);
    expect(save).toHaveBeenCalledTimes(3);
  });

  it("resolves flush even when the save is failing", async () => {
    // Closing the note must not depend on the network: the draft holds the
    // content, so a rejection here would only strand the user in the editor.
    const save = vi.fn().mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useAutosave(save));

    act(() => result.current.schedule());
    await act(async () => {
      await expect(result.current.flush()).resolves.toBeUndefined();
    });
    await flushReact();
    expect(result.current.status).toBe("error"); // it reports the failure, it just doesn't throw it
  });
});

describe("useAutosave on the way out", () => {
  it("saves when the page is hidden, with a request that outlives it", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave(save));

    act(() => result.current.schedule());
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // keepalive is what lets the request finish after the page is gone.
    expect(save).toHaveBeenCalledWith({ keepalive: true });
    visibility.mockRestore();
  });

  it("retries as soon as the network comes back", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave(save));

    act(() => result.current.schedule());
    await advance(AUTOSAVE_DELAY_MS);
    expect(result.current.status).toBe("error");

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
  });
});
