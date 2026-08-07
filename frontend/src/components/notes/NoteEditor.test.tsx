import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api";
import { resetNavigation, routerMock } from "@/test/next-navigation";
import type { Note } from "@/types/note";

import { NoteEditor } from "./NoteEditor";

vi.mock("next/navigation");
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const note: Note = {
  id: 7,
  title: "A note",
  body: "Body",
  category: { id: 1, name: "Personal" },
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-02T10:00:00Z",
  archived_at: null,
};

describe("NoteEditor archiving", () => {
  beforeEach(() => {
    resetNavigation();
    vi.mocked(apiFetch).mockReset().mockResolvedValue([note.category]);
  });

  it("sends no request when the confirm is declined", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<NoteEditor initialNote={note} />);

    await userEvent.click(await screen.findByRole("button", { name: /archive note/i }));

    expect(apiFetch).not.toHaveBeenCalledWith("/notes/7/", { method: "DELETE" });
    expect(routerMock.push).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("archives and returns to the dashboard when confirmed", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<NoteEditor initialNote={note} />);

    await userEvent.click(await screen.findByRole("button", { name: /archive note/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/notes/7/", { method: "DELETE" });
    });
    expect(routerMock.push).toHaveBeenCalledWith("/dashboard");
    confirmSpy.mockRestore();
  });

  it("promises the archive rather than claiming the delete is permanent", async () => {
    // The old copy said "This can't be undone", which stopped being true the
    // moment DELETE started archiving.
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<NoteEditor initialNote={note} />);

    await userEvent.click(await screen.findByRole("button", { name: /archive note/i }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("archive"));
    expect(confirmSpy).not.toHaveBeenCalledWith(expect.stringContaining("can't be undone"));
    confirmSpy.mockRestore();
  });
});
