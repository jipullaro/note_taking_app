import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  describe("mobile drawer", () => {
    // Below md the sidebar slides in over the notes instead of standing beside
    // them; the button is hidden by CSS from md up, which jsdom can't see.
    it("starts closed and opens on the menu button", async () => {
      render(<Sidebar />);
      await screen.findByRole("link", { name: /archive/i });

      const toggle = screen.getByRole("button", { name: /open menu/i });
      expect(toggle).toHaveAttribute("aria-expanded", "false");

      await userEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      // Focus lands in the drawer so the next Tab walks its links, not the
      // page behind it.
      expect(screen.getByRole("button", { name: /close menu/i })).toHaveFocus();
    });

    it("closes on Escape, returning focus to the menu button", async () => {
      render(<Sidebar />);
      await screen.findByRole("link", { name: /archive/i });

      const toggle = screen.getByRole("button", { name: /open menu/i });
      await userEvent.click(toggle);
      await userEvent.keyboard("{Escape}");

      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(toggle).toHaveFocus();
    });

    it("closes when the route changes", async () => {
      const { rerender } = render(<Sidebar />);
      await screen.findByRole("link", { name: /archive/i });

      const toggle = screen.getByRole("button", { name: /open menu/i });
      await userEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");

      // Tapping a category navigates without unmounting the sidebar, so the
      // drawer has to notice the route change and get out of the way.
      setPathname("/archive");
      rerender(<Sidebar />);

      await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"));
    });

    it("releases the page's scroll lock once closed", async () => {
      render(<Sidebar />);
      await screen.findByRole("link", { name: /archive/i });

      const toggle = screen.getByRole("button", { name: /open menu/i });
      await userEvent.click(toggle);
      expect(document.body.style.overflow).toBe("hidden");

      await userEvent.click(screen.getByRole("button", { name: /close menu/i }));
      expect(document.body.style.overflow).not.toBe("hidden");
    });
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
