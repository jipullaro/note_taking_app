import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api";
import { emitNotesChanged } from "@/lib/events";
import { resetNavigation, setPathname } from "@/test/next-navigation";

import { Sidebar } from "./Sidebar";

vi.mock("next/navigation");
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const counts = {
  categories: [{ id: 1, name: "Personal", count: 2 }],
  all: 2,
  archived: 3,
};

describe("Sidebar", () => {
  beforeEach(() => {
    resetNavigation();
    vi.mocked(apiFetch).mockReset().mockResolvedValue(counts);
  });

  it("links to the archive with its count", async () => {
    render(<Sidebar />);

    const link = await screen.findByRole("link", { name: /archive/i });
    expect(link).toHaveAttribute("href", "/archive");
    expect(link).toHaveTextContent("3");
  });

  it("links to the unfiltered dashboard with the total count", async () => {
    render(<Sidebar />);

    const link = await screen.findByRole("link", { name: /all notes/i });
    expect(link).toHaveAttribute("href", "/dashboard");
    expect(link).toHaveTextContent("2");
  });

  it("does not mark All Notes active on the archive route", async () => {
    // No category is active on /archive either, so a bare !activeCategory
    // check renders this as the selected item while you're elsewhere.
    setPathname("/archive");
    render(<Sidebar />);

    const allNotes = await screen.findByRole("link", { name: /all notes/i });
    expect(allNotes.className).not.toMatch(/font-bold/);
  });

  it("marks All Notes active on the unfiltered dashboard", async () => {
    setPathname("/dashboard");
    render(<Sidebar />);

    const allNotes = await screen.findByRole("link", { name: /all notes/i });
    expect(allNotes.className).toMatch(/font-bold/);
  });

  it("refreshes counts on the notes-changed event, without navigating", async () => {
    render(<Sidebar />);
    await screen.findByRole("link", { name: /archive/i });

    vi.mocked(apiFetch).mockResolvedValue({ ...counts, archived: 4 });
    emitNotesChanged();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /archive/i })).toHaveTextContent("4");
    });
  });
});
