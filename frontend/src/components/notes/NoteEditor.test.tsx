import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

/** Renders and flushes the categories fetch the editor kicks off on mount. */
async function renderEditor(note: Note | undefined = NOTE) {
  const view = render(<NoteEditor initialNote={note} />);
  await screen.findByLabelText("Note body");
  return view;
}

function body() {
  return screen.getByLabelText("Note body");
}

function textarea() {
  return screen.getByPlaceholderText("Pour your heart out…");
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
  it("shows the rendered markdown, not a textarea, on load", async () => {
    const { container } = await renderEditor();

    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector("strong")).toHaveTextContent("tonight");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    // The markup characters themselves are gone from the rendered view.
    expect(body().textContent).not.toContain("**");
  });

  it("swaps in a textarea holding the RAW markdown when clicked", async () => {
    await renderEditor();
    fireEvent.click(body());

    const input = textarea();
    expect(input).toHaveValue(NOTE.body);
    expect(input).toHaveFocus();
    expect(screen.queryByLabelText("Note body")).toBeNull();
  });

  it("swaps back to the rendered output on blur", async () => {
    const { container } = await renderEditor();
    fireEvent.click(body());
    fireEvent.blur(textarea());

    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector("ul")).not.toBeNull();
  });

  it("shows a clickable placeholder for an empty body", async () => {
    await renderEditor({ ...NOTE, body: "" });

    expect(screen.getByText("Pour your heart out…")).toBeInTheDocument();
    fireEvent.click(body());
    expect(textarea()).toHaveFocus();
  });

  it("still autosaves after the swap, and blur adds no extra save", async () => {
    await renderEditor();
    fireEvent.click(body());
    fireEvent.change(textarea(), { target: { value: "- milk\n- eggs\n- **bread**" } });
    // Blurring mid-debounce must not race or duplicate the pending save.
    fireEvent.blur(textarea());

    await waitFor(
      () => {
        expect(apiFetchMock).toHaveBeenCalledWith(
          "/notes/1/",
          expect.objectContaining({ method: "PATCH" })
        );
      },
      { timeout: 2000 }
    );

    const saves = apiFetchMock.mock.calls.filter(([path]) => path === "/notes/1/");
    expect(saves).toHaveLength(1);
    expect(JSON.parse(saves[0][1]?.body as string).body).toBe("- milk\n- eggs\n- **bread**");
  });
});
