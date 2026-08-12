import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetNavigation } from "@/test/next-navigation";
import type { Note } from "@/types/note";

import { NoteSearch } from "./NoteSearch";

vi.mock("next/navigation");

function makeNote(overrides: Partial<Note>): Note {
  return {
    id: 1,
    title: "Untitled",
    body: "",
    category: { id: 1, name: "Personal", position: 0 },
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-02T10:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

const notes = [
  makeNote({ id: 1, title: "Groceries", body: "- buy **milk**" }),
  makeNote({ id: 2, title: "Standup", body: "Talk about the migration" }),
];

function searchField() {
  return screen.getByRole("searchbox", { name: "Search notes" });
}

describe("NoteSearch", () => {
  beforeEach(() => {
    resetNavigation();
  });

  it("shows every note before anything is typed", () => {
    render(<NoteSearch notes={notes} />);

    expect(screen.getByRole("heading", { name: "Groceries" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Standup" })).toBeInTheDocument();
  });

  it("filters by title as the user types, case-insensitively", async () => {
    render(<NoteSearch notes={notes} />);

    await userEvent.type(searchField(), "grocer");

    expect(screen.getByRole("heading", { name: "Groceries" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Standup" })).not.toBeInTheDocument();
  });

  it("filters by body text too", async () => {
    render(<NoteSearch notes={notes} />);

    await userEvent.type(searchField(), "MIGRATION");

    expect(screen.getByRole("heading", { name: "Standup" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Groceries" })).not.toBeInTheDocument();
  });

  it("explains an empty result instead of showing a blank page", async () => {
    render(<NoteSearch notes={notes} />);

    await userEvent.type(searchField(), "zzz");

    expect(screen.getByText(/no notes match/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Groceries" })).not.toBeInTheDocument();
  });

  it("brings every note back when the empty state's clear button is used", async () => {
    render(<NoteSearch notes={notes} />);
    await userEvent.type(searchField(), "zzz");

    // Two buttons carry that name while the empty state is up — the one in
    // the field and the one under the message. This is the latter.
    const [, emptyStateClear] = screen.getAllByRole("button", { name: "Clear search" });
    await userEvent.click(emptyStateClear);

    expect(searchField()).toHaveValue("");
    expect(screen.getByRole("heading", { name: "Groceries" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Standup" })).toBeInTheDocument();
  });

  it("offers the in-field clear button only while searching, and returns focus to the field", async () => {
    render(<NoteSearch notes={notes} />);
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();

    await userEvent.type(searchField(), "grocer");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(searchField()).toHaveValue("");
    // The button unmounts on clear, so focus has to be handed back explicitly
    // or it lands on <body> and the next keystroke goes nowhere.
    expect(searchField()).toHaveFocus();
  });

  it("clears on Escape", async () => {
    render(<NoteSearch notes={notes} />);
    await userEvent.type(searchField(), "grocer");

    await userEvent.keyboard("{Escape}");

    expect(searchField()).toHaveValue("");
    expect(screen.getByRole("heading", { name: "Standup" })).toBeInTheDocument();
  });

  it("ignores a query that is only whitespace", async () => {
    render(<NoteSearch notes={notes} />);

    await userEvent.type(searchField(), "   ");

    expect(screen.getByRole("heading", { name: "Groceries" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Standup" })).toBeInTheDocument();
  });

  it("falls back to the plain empty state when there are no notes at all", () => {
    render(<NoteSearch notes={[]} />);

    expect(screen.queryByText(/no notes match/i)).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search notes" })).toBeInTheDocument();
  });
});
