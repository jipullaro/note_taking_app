import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api";
import { resetNavigation } from "@/test/next-navigation";
import type { Note } from "@/types/note";

import { NoteEditor } from "./NoteEditor";

vi.mock("next/navigation");
vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

const apiFetchMock = vi.mocked(apiFetch);

const NOTE: Note = {
  id: 1,
  title: "Groceries",
  body: "Shopping for **tonight**:\n- milk\n- eggs",
  category: { id: 1, name: "Personal" },
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
};

/** Renders and waits for the editor body to take over the DOM. */
async function renderEditor(note: Note | undefined = NOTE) {
  const view = render(<NoteEditor initialNote={note} />);
  const body = await screen.findByLabelText("Note body");
  return { ...view, body };
}

beforeEach(() => {
  resetNavigation();
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((path: string) => {
    if (path === "/categories/") return Promise.resolve([NOTE.category]);
    return Promise.resolve({ ...NOTE, updated_at: "2026-08-02T10:00:00Z" });
  });
});

describe("NoteEditor body", () => {
  it("shows the stored markdown as formatting, in an editable surface", async () => {
    const { container, body } = await renderEditor();

    expect(container.querySelector("strong")).toHaveTextContent("tonight");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(body.textContent).not.toContain("**");
    // The formatting is live, not a read-only preview you have to click into.
    expect(body).toHaveAttribute("contenteditable", "true");
  });

  it("has no textarea — formatting is applied in place", async () => {
    const { container } = await renderEditor();
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("autosaves the body as markdown after typing", async () => {
    const { body } = await renderEditor({ ...NOTE, body: "" });

    await userEvent.click(body);
    await userEvent.keyboard("- milk");

    await waitFor(
      () => {
        expect(apiFetchMock).toHaveBeenCalledWith(
          "/notes/1/",
          expect.objectContaining({ method: "PATCH" })
        );
      },
      { timeout: 3000 }
    );

    const saves = apiFetchMock.mock.calls.filter(([path]) => path === "/notes/1/");
    // Markdown, not the editor's HTML — the API's storage format is unchanged.
    expect(JSON.parse(saves.at(-1)![1]?.body as string).body).toBe("- milk");
  });

  it("debounces rather than saving on every keystroke", async () => {
    const { body } = await renderEditor({ ...NOTE, body: "" });

    await userEvent.click(body);
    await userEvent.keyboard("hello");

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/notes/1/", expect.anything()), {
      timeout: 3000,
    });

    const saves = apiFetchMock.mock.calls.filter(([path]) => path === "/notes/1/");
    expect(saves.length).toBeLessThan(5); // one per character would be 5
  });
});
