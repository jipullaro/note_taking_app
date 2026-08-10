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
  categories: [{ id: 1, name: "Personal", position: 0, count: 2 }],
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

  it("does not mark All Categories active on the archive route", async () => {
    // No category is active on /archive either, so a bare !activeCategory
    // check renders this as the selected item while you're elsewhere.
    setPathname("/archive");
    render(<Sidebar />);

    const allCategories = await screen.findByRole("link", { name: "All Categories" });
    expect(allCategories.className).not.toMatch(/underline/);
  });

  it("marks All Categories active on the unfiltered dashboard", async () => {
    setPathname("/dashboard");
    render(<Sidebar />);

    const allCategories = await screen.findByRole("link", { name: "All Categories" });
    expect(allCategories.className).toMatch(/underline/);
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
