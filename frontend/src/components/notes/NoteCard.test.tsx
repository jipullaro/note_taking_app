import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api";
import { NOTES_CHANGED_EVENT } from "@/lib/events";
import { resetNavigation, routerMock } from "@/test/next-navigation";
import { captureToasts } from "@/test/toasts";
import type { Note } from "@/types/note";

import { NoteCard } from "./NoteCard";

vi.mock("next/navigation");
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const note: Note = {
  id: 7,
  title: "Live note",
  body: "Some body",
  category: { id: 1, name: "Personal", position: 0 },
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-02T10:00:00Z",
  archived_at: null,
};

/** Opens the confirmation, then answers it. */
async function clickDelete() {
  await userEvent.click(screen.getByRole("button", { name: /^delete/i }));
}

async function confirmArchive() {
  await clickDelete();
  await userEvent.click(screen.getByRole("button", { name: "Move to archive" }));
}

describe("NoteCard", () => {
  const toasts = captureToasts();

  beforeEach(() => {
    resetNavigation();
    vi.mocked(apiFetch).mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("links to the editor", () => {
    render(<NoteCard note={note} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/notes/7");
  });

  it("offers a delete button named after the note", () => {
    render(<NoteCard note={note} />);

    expect(screen.getByRole("button", { name: "Delete Live note" })).toBeEnabled();
  });

  it("labels the icon-only button entirely through aria-label", () => {
    render(<NoteCard note={note} />);

    // Nothing visible spells "Delete" any more, so the aria-label is the only
    // thing standing between a screen reader and an unnamed button.
    const button = screen.getByRole("button", { name: "Delete Live note" });
    expect(button).toHaveTextContent("");
  });

  it("stays in the tree when the card isn't hovered", () => {
    render(<NoteCard note={note} />);

    // Hidden with opacity, never `display: none` or conditional rendering:
    // either of those would take the button out of the tab order and off the
    // accessibility tree, stranding anyone not using a mouse.
    const button = screen.getByRole("button", { name: "Delete Live note" });
    button.focus();

    expect(button).toHaveFocus();
  });

  it("asks for confirmation in an in-app dialog rather than window.confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    render(<NoteCard note={note} />);

    await clickDelete();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    // The grid can show many notes; the dialog has to say which one it means.
    expect(screen.getByRole("dialog")).toHaveTextContent("Live note");
  });

  it("deletes the note and refreshes when confirmed", async () => {
    render(<NoteCard note={note} />);

    await confirmArchive();

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/notes/7/", { method: "DELETE" });
    });
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it("sends no request when the confirm is declined", async () => {
    render(<NoteCard note={note} />);

    await clickDelete();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("promises the archive rather than claiming the delete is permanent", async () => {
    // DELETE archives, matching the editor's trash button — so the copy must
    // not tell the user the note is gone for good.
    render(<NoteCard note={note} />);

    await clickDelete();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/archive/i);
    expect(dialog).not.toHaveTextContent(/can't be undone/i);
  });

  it("does not open the note when the delete button is clicked", async () => {
    // The button sits outside the <a> precisely so this can't happen; assert
    // it so a later refactor to an overlay link doesn't reintroduce it.
    render(<NoteCard note={note} />);

    const button = screen.getByRole("button", { name: /^delete/i });
    expect(button.closest("a")).toBeNull();

    const navigated = vi.fn();
    window.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("a")) navigated();
    });
    await userEvent.click(button);

    expect(navigated).not.toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("announces the change so the sidebar counts can catch up", async () => {
    const listener = vi.fn();
    window.addEventListener(NOTES_CHANGED_EVENT, listener);

    render(<NoteCard note={note} />);
    await confirmArchive();

    await waitFor(() => expect(listener).toHaveBeenCalled());
    window.removeEventListener(NOTES_CHANGED_EVENT, listener);
  });

  it("reports a failed delete, closes the dialog and re-enables the button", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("boom"));

    render(<NoteCard note={note} />);
    await confirmArchive();

    await waitFor(() => expect(toasts).toHaveLength(1));
    expect(toasts[0].variant).toBe("error");
    // A dialog left up over the error would trap focus behind the message.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^delete/i })).toBeEnabled();
  });

  it("confirms the archive on success, since the card disappears", async () => {
    render(<NoteCard note={note} />);
    await confirmArchive();

    await waitFor(() => expect(toasts).toHaveLength(1));
    expect(toasts[0]).toEqual({
      message: expect.stringContaining("archive"),
      variant: "success",
    });
  });
});
