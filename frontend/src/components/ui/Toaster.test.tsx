import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TOAST_DURATION_MS, showErrorToast, showToast } from "@/lib/toast";

import { Toaster } from "./Toaster";

/** showToast dispatches synchronously, but the subscriber's setState needs a tick. */
function raise(fn: () => void) {
  act(fn);
}

describe("Toaster", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a toast raised from anywhere in the tree", () => {
    render(<Toaster />);

    raise(() => showToast("Note moved to the archive."));

    expect(screen.getByText("Note moved to the archive.")).toBeInTheDocument();
  });

  it("shows nothing until something is raised", () => {
    render(<Toaster />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("marks errors assertive and successes polite", () => {
    render(<Toaster />);

    raise(() => showErrorToast("Couldn't delete that note."));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't delete that note.");

    raise(() => showToast("Note restored."));
    expect(screen.getByRole("status")).toHaveTextContent("Note restored.");
  });

  it("keeps the live region mounted so insertions get announced", () => {
    const { container } = render(<Toaster />);

    // Empty, but present: a region added at the same time as its content is
    // not reliably announced by screen readers.
    expect(container.querySelector("[aria-live='polite']")).toBeInTheDocument();
  });

  it("dismisses a toast when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(<Toaster />);

    raise(() => showToast("Note restored."));
    await user.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(screen.queryByText("Note restored.")).not.toBeInTheDocument();
  });

  it("auto-dismisses after the variant's duration", () => {
    vi.useFakeTimers();
    render(<Toaster />);

    raise(() => showToast("Note restored."));
    expect(screen.getByText("Note restored.")).toBeInTheDocument();

    // Errors outlive successes, so a success must still be gone at its own
    // shorter deadline.
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS.success));
    expect(screen.queryByText("Note restored.")).not.toBeInTheDocument();
  });

  it("keeps errors up longer than successes", () => {
    vi.useFakeTimers();
    render(<Toaster />);

    raise(() => showErrorToast("Couldn't delete that note."));

    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS.success));
    expect(screen.getByText("Couldn't delete that note.")).toBeInTheDocument();

    act(() =>
      vi.advanceTimersByTime(TOAST_DURATION_MS.error - TOAST_DURATION_MS.success)
    );
    expect(screen.queryByText("Couldn't delete that note.")).not.toBeInTheDocument();
  });

  it("stacks several at once", () => {
    render(<Toaster />);

    raise(() => showToast("First."));
    raise(() => showToast("Second."));

    expect(screen.getAllByRole("status")).toHaveLength(2);
  });

  it("drops the oldest rather than overflowing the viewport", () => {
    render(<Toaster />);

    raise(() => showToast("First."));
    raise(() => showToast("Second."));
    raise(() => showToast("Third."));
    raise(() => showToast("Fourth."));

    expect(screen.queryByText("First.")).not.toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(3);
  });

  it("stops listening once unmounted", () => {
    const { unmount } = render(<Toaster />);
    unmount();

    // Would throw on a setState-after-unmount if the listener outlived it.
    expect(() => showToast("Nobody home.")).not.toThrow();
  });
});
