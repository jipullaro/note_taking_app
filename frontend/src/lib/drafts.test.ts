import { afterEach, describe, expect, it, vi } from "vitest";

import { clearDraft, readDraft, writeDraft } from "./drafts";

const content = { title: "Groceries", body: "- milk", categoryId: 1 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("drafts", () => {
  it("round-trips a note's unsaved content", () => {
    writeDraft(7, content);
    expect(readDraft(7)).toMatchObject(content);
  });

  it("has nothing to say about a note that was never edited", () => {
    expect(readDraft(7)).toBeNull();
  });

  it("keeps each note's draft to itself", () => {
    writeDraft(7, content);
    writeDraft(8, { ...content, title: "Other" });

    expect(readDraft(7)).toMatchObject({ title: "Groceries" });
    expect(readDraft(8)).toMatchObject({ title: "Other" });
  });

  it("gives a note that doesn't exist yet its own slot", () => {
    // A new note has no id until its first save lands, so `null` has to be a
    // key in its own right rather than colliding with a real note's.
    writeDraft(null, content);
    expect(readDraft(null)).toMatchObject(content);
    expect(readDraft(7)).toBeNull();
  });

  it("forgets a draft once it's cleared", () => {
    writeDraft(7, content);
    clearDraft(7);
    expect(readDraft(7)).toBeNull();
  });

  it("drops a draft that was abandoned long enough to be stale", () => {
    // Drafts are normally removed by the next successful save, so anything
    // this old belongs to a save that never succeeded and a note the user has
    // long since moved on from.
    writeDraft(7, content);
    const eightDaysOn = Date.now() + 8 * 24 * 60 * 60 * 1000;
    vi.spyOn(Date, "now").mockReturnValue(eightDaysOn);

    expect(readDraft(7)).toBeNull();
  });

  it("keeps a draft that's merely a few days old", () => {
    writeDraft(7, content);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3 * 24 * 60 * 60 * 1000);

    expect(readDraft(7)).toMatchObject(content);
  });

  it("ignores stored junk rather than restoring half a note", () => {
    window.localStorage.setItem("note-draft:7", "{not json");
    expect(readDraft(7)).toBeNull();

    window.localStorage.setItem("note-draft:7", JSON.stringify({ title: "only a title" }));
    expect(readDraft(7)).toBeNull();
  });

  it("carries on when storage refuses to play", () => {
    // Private modes and full quotas both throw. A draft is the backup copy —
    // losing it must not take the editor down with it.
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => writeDraft(7, content)).not.toThrow();

    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readDraft(7)).toBeNull();
  });
});
