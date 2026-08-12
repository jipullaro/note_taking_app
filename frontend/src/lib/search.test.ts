import { describe, expect, it } from "vitest";

import { filterNotes, noteSearchText, normalizeQuery } from "@/lib/search";
import type { Note } from "@/types/note";

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

const groceries = makeNote({ id: 1, title: "Groceries", body: "- buy **milk**\n- eggs" });
const standup = makeNote({ id: 2, title: "Standup notes", body: "Talk about the MIGRATION." });

describe("noteSearchText", () => {
  it("includes the title and the body", () => {
    expect(noteSearchText(standup)).toContain("standup notes");
    expect(noteSearchText(standup)).toContain("talk about the migration.");
  });

  it("strips markdown markers so the haystack is what the card shows", () => {
    // A user searching for their own bullet types "buy milk", not "buy **milk**".
    expect(noteSearchText(groceries)).toContain("buy milk");
  });
});

describe("normalizeQuery", () => {
  it("trims and lower-cases", () => {
    expect(normalizeQuery("  MiLk ")).toBe("milk");
  });

  it("treats whitespace as no query at all", () => {
    expect(normalizeQuery("   ")).toBe("");
  });
});

describe("filterNotes", () => {
  const notes = [groceries, standup];

  it("returns everything for an empty or blank query", () => {
    expect(filterNotes(notes, "")).toBe(notes);
    expect(filterNotes(notes, "   ")).toBe(notes);
  });

  it("matches the title case-insensitively", () => {
    expect(filterNotes(notes, "GROCER")).toEqual([groceries]);
  });

  it("matches the body case-insensitively", () => {
    expect(filterNotes(notes, "migration")).toEqual([standup]);
  });

  it("keeps the original order and returns nothing when nothing matches", () => {
    expect(filterNotes(notes, "s")).toEqual([groceries, standup]);
    expect(filterNotes(notes, "zzz")).toEqual([]);
  });
});
