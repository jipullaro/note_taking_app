/**
 * Local drafts: the crash net under the autosave in lib/autosave.
 *
 * Autosaving always leaves a window where what's on screen isn't on the
 * server yet — the debounce, a request in flight, a failed save waiting on
 * its backoff. Mirroring the editor into localStorage on every change closes
 * it: the write is synchronous and can't fail the way a request can, so
 * closing the tab mid-sentence (or losing the network outright) costs
 * nothing.
 *
 * A draft is deleted as soon as the same content lands on the server, which
 * gives the presence of one meaning: it says "this was never saved". That's
 * what lets NoteEditor restore a draft on load without having to reason about
 * which copy is newer.
 */

const KEY_PREFIX = "note-draft:";

/**
 * How long an abandoned draft is kept. Drafts are normally removed by the
 * next successful save, so this only catches the ones whose save never
 * succeeded — without it they'd sit in localStorage forever.
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface NoteDraft {
  title: string;
  body: string;
  categoryId: number;
  /** ISO timestamp. Only used to expire drafts that were never saved. */
  savedAt: string;
}

/** A note that hasn't been created yet has no id, so it gets the "new" slot. */
function keyFor(noteId: number | null): string {
  return `${KEY_PREFIX}${noteId ?? "new"}`;
}

export function readDraft(noteId: number | null): NoteDraft | null {
  if (typeof window === "undefined") return null;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(keyFor(noteId));
  } catch {
    return null; // storage disabled entirely (some private modes)
  }
  if (raw === null) return null;

  try {
    const draft = JSON.parse(raw) as NoteDraft;
    // Anything that doesn't parse into the shape below is from an older
    // version of this code or a different tenant of the same key. Drop it
    // rather than restoring half a note over the server's copy.
    if (
      typeof draft?.title !== "string" ||
      typeof draft?.body !== "string" ||
      typeof draft?.categoryId !== "number"
    ) {
      clearDraft(noteId);
      return null;
    }
    if (Date.now() - Date.parse(draft.savedAt) > MAX_AGE_MS) {
      clearDraft(noteId);
      return null;
    }
    return draft;
  } catch {
    clearDraft(noteId);
    return null;
  }
}

export function writeDraft(noteId: number | null, draft: Omit<NoteDraft, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      keyFor(noteId),
      JSON.stringify({ ...draft, savedAt: new Date().toISOString() })
    );
  } catch {
    /* Quota full or storage disabled. The note still autosaves over the API —
       this is the belt, not the braces. */
  }
}

export function clearDraft(noteId: number | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(noteId));
  } catch {
    /* see writeDraft */
  }
}
