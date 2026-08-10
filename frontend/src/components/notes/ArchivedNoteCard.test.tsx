import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api";
import { NOTES_CHANGED_EVENT } from "@/lib/events";
import { resetNavigation, routerMock } from "@/test/next-navigation";
import { captureToasts } from "@/test/toasts";
import type { Note } from "@/types/note";

import { ArchivedNoteCard } from "./ArchivedNoteCard";

vi.mock("next/navigation");
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const note: Note = {
  id: 12,
  title: "Archived note",
  body: "Some body",
  category: { id: 1, name: "Personal" },
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-02T10:00:00Z",
  archived_at: "2026-08-05T10:00:00Z",
};

describe("ArchivedNoteCard", () => {
  const toasts = captureToasts();

  beforeEach(() => {
    resetNavigation();
    vi.mocked(apiFetch).mockReset().mockResolvedValue(undefined);
  });

  it("restores the note and refreshes", async () => {
    render(<ArchivedNoteCard note={note} />);

    await userEvent.click(screen.getByRole("button", { name: /restore/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/notes/12/restore/", { method: "POST" });
    });
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it("announces the change so the sidebar counts can catch up", async () => {
    // Restoring leaves you on /archive, so the sidebar's pathname-keyed
    // effect never re-runs and router.refresh() won't reset its client state.
    const listener = vi.fn();
    window.addEventListener(NOTES_CHANGED_EVENT, listener);

    render(<ArchivedNoteCard note={note} />);
    await userEvent.click(screen.getByRole("button", { name: /restore/i }));

    await waitFor(() => expect(listener).toHaveBeenCalled());
    window.removeEventListener(NOTES_CHANGED_EVENT, listener);
  });

  it("reports a failed restore and re-enables the button", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("boom"));

    render(<ArchivedNoteCard note={note} />);
    await userEvent.click(screen.getByRole("button", { name: /restore/i }));

    await waitFor(() => expect(toasts).toHaveLength(1));
    expect(toasts[0].variant).toBe("error");
    expect(screen.getByRole("button", { name: /restore/i })).toBeEnabled();
  });

  it("does not link to the editor", () => {
    // The editor autosaves, so opening an archived note would start PATCHing
    // a note the user thinks is deleted — and the API 404s it anyway.
    const { container } = render(<ArchivedNoteCard note={note} />);
    expect(container.querySelector("a")).toBeNull();
  });
});
