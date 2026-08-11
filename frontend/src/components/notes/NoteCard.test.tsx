import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api";
import { NOTES_CHANGED_EVENT } from "@/lib/events";
import { resetNavigation, routerMock } from "@/test/next-navigation";
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

describe("NoteCard", () => {
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

  it("deletes the note and refreshes when confirmed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<NoteCard note={note} />);

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/notes/7/", { method: "DELETE" });
    });
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it("sends no request when the confirm is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<NoteCard note={note} />);

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(apiFetch).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("promises the archive rather than claiming the delete is permanent", async () => {
    // DELETE archives, matching the editor's trash button — so the copy must
    // not tell the user the note is gone for good.
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<NoteCard note={note} />);

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("archive"));
  });

  it("does not open the note when the delete button is clicked", async () => {
    // The button sits outside the <a> precisely so this can't happen; assert
    // it so a later refactor to an overlay link doesn't reintroduce it.
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<NoteCard note={note} />);

    const button = screen.getByRole("button", { name: /delete/i });
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
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const listener = vi.fn();
    window.addEventListener(NOTES_CHANGED_EVENT, listener);

    render(<NoteCard note={note} />);
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => expect(listener).toHaveBeenCalled());
    window.removeEventListener(NOTES_CHANGED_EVENT, listener);
  });

  it("reports a failed delete and re-enables the button", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.mocked(apiFetch).mockRejectedValue(new Error("boom"));

    render(<NoteCard note={note} />);
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /delete/i })).toBeEnabled();
  });
});
