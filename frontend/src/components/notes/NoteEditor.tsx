"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, apiErrorMessage } from "@/lib/api";
import { useAutosave } from "@/lib/autosave";
import { clearDraft, readDraft, writeDraft } from "@/lib/drafts";
import { emitNotesChanged } from "@/lib/events";
import { showErrorToast } from "@/lib/toast";
import { colorForCategory } from "@/lib/categories";
import { formatLastEdited } from "@/lib/date";
import { CategoryDropdown } from "./CategoryDropdown";
import { NoteBodyEditor } from "./NoteBodyEditor";
import { CloseIcon, TrashIcon } from "@/components/ui/icons";
import type { Category, Note } from "@/types/note";

/**
 * The draft restore has to run before the browser paints, but this component
 * is server-rendered first and useLayoutEffect does nothing there — React
 * warns about exactly that. On the server there is no paint to be ahead of,
 * so fall back to useEffect and keep the warning off the console.
 */
const useLayoutEffectOnClient = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Everything a save sends. Held in a ref as well as state — see `content`. */
interface EditorContent {
  title: string;
  body: string;
  category: Category | null;
}

/**
 * Shared editor for both creating and editing a note. The Figma mockup has
 * no explicit "Save" button — only a close "X" — so this autosaves rather
 * than requiring an explicit save action.
 *
 * Two pieces do the work, and the split is worth knowing about:
 *
 *   - lib/autosave decides *when* to talk to the API — debounced while
 *     typing, capped so a fast typist still saves, one request at a time,
 *     retried with backoff, flushed when the page goes away.
 *   - lib/drafts mirrors the content into localStorage on every change, so
 *     whatever the API hasn't got yet is still recoverable.
 *
 * Between them there's no keystroke whose loss costs more than a reload.
 */
export function NoteEditor({ initialNote }: { initialNote?: Note }) {
  const router = useRouter();
  const [id, setId] = useState<number | null>(initialNote?.id ?? null);
  const [title, setTitle] = useState(initialNote?.title ?? "");
  const [body, setBody] = useState(initialNote?.body ?? "");
  const [category, setCategory] = useState<Category | null>(initialNote?.category ?? null);
  const [categories, setCategories] = useState<Category[]>(
    initialNote ? [initialNote.category] : []
  );
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(initialNote?.updated_at);
  const [deleting, setDeleting] = useState(false);
  // Only used by the no-categories-at-all form below; the dropdown keeps its
  // own input state once there's at least one category to hang it off.
  const [firstCategoryName, setFirstCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  // The id and the content are held in refs *as well as* state, and the refs
  // are what a save reads. A save can finish and immediately start a
  // follow-up for edits made while it was out, all before React has
  // re-rendered — so a save that read the id from state would still see null
  // just after creating the note, and POST a second one.
  const idRef = useRef<number | null>(initialNote?.id ?? null);
  const contentRef = useRef<EditorContent>({ title, body, category });
  const restoredRef = useRef(false);
  // A restored draft's category id, waiting for the category list to land.
  const pendingCategoryRef = useRef<number | null>(null);
  // Bumped to remount the body editor; see the restore effect below.
  const [bodyRevision, setBodyRevision] = useState(0);

  const autosave = useAutosave(async ({ keepalive }) => {
    const sent = contentRef.current;
    if (!sent.category) return; // nothing to save without a category yet

    const savedUnder = idRef.current;
    const payload = { title: sent.title, body: sent.body, category_id: sent.category.id };

    if (savedUnder === null) {
      const created = await apiFetch<Note>("/notes/", {
        method: "POST",
        body: JSON.stringify(payload),
        keepalive,
      });
      idRef.current = created.id;
      setId(created.id);
      setUpdatedAt(created.updated_at);
      emitNotesChanged();
    } else {
      const updated = await apiFetch<Note>(`/notes/${savedUnder}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
        keepalive,
      });
      setUpdatedAt(updated.updated_at);
    }

    // This content is on the server now, so the draft mirroring it can go.
    clearDraft(savedUnder);

    // Compared by value rather than by object identity: contentRef is also
    // replaced by things that aren't edits (the category default landing from
    // /categories/), and an identity check reads those as "the user typed
    // during the request" and leaves a draft behind that nothing clears.
    const now = contentRef.current;
    if (
      now.category &&
      (now.title !== sent.title ||
        now.body !== sent.body ||
        now.category.id !== sent.category.id)
    ) {
      // Edits landed while the request was out. Re-file their draft under the
      // id the note has now — otherwise a "new note" draft outlives the note
      // it belonged to and gets restored into the *next* new note.
      writeDraft(idRef.current, {
        title: now.title,
        body: now.body,
        categoryId: now.category.id,
      });
    }
  });

  /**
   * The single way content changes. Funnelling everything through here keeps
   * the ref, the React state and the draft in step, which matters because
   * `contentRef` is what a save reads: a handler that only called setState
   * would save the *previous* content, since state hasn't landed yet by the
   * time an immediate flush (a category change, closing the note) runs.
   */
  function update(patch: Partial<EditorContent>) {
    const next = { ...contentRef.current, ...patch };
    contentRef.current = next;

    if (patch.title !== undefined) setTitle(patch.title);
    if (patch.body !== undefined) setBody(patch.body);
    if (patch.category !== undefined) setCategory(patch.category);

    if (next.category) {
      writeDraft(idRef.current, {
        title: next.title,
        body: next.body,
        categoryId: next.category.id,
      });
    }
    autosave.schedule();
  }

  // Load the user's categories so a brand-new note can default to one
  // (usually "Personal", seeded on registration) and the dropdown has
  // something to offer.
  useEffect(() => {
    apiFetch<Category[]>("/categories/")
      .then((data) => {
        setCategories(data);
        // Not via update(): defaulting the category isn't an edit, and
        // scheduling a save here would create an empty note just for opening
        // /notes/new. Only touched when it actually resolves something, so a
        // note that already had a category doesn't see contentRef change for
        // no reason (a save in flight reads that as an edit).
        const next = contentRef.current.category ?? data[0] ?? null;
        if (next !== contentRef.current.category) {
          contentRef.current = { ...contentRef.current, category: next };
          setCategory(next);
        }

        // Second half of the restore below: a draft records a category by id,
        // and only now is there a list to turn that back into the object the
        // picker renders.
        const wanted = pendingCategoryRef.current;
        pendingCategoryRef.current = null;
        const draftCategory = data.find((c) => c.id === wanted);
        if (draftCategory && draftCategory.id !== contentRef.current.category?.id) {
          update({ category: draftCategory });
        }
      })
      .catch(() => {
        /* the editor still works with just the category it was loaded with */
      })
      .finally(() => setCategoriesLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetched once on mount; update() reads its inputs from refs
  }, []);

  /*
   * Restore an unsaved draft, if there is one.
   *
   * Before paint, and without waiting for the categories: gating this on the
   * fetch meant the note rendered the server's older copy first and only
   * swapped in the draft once /categories/ came back, so a reload mid-edit
   * showed the user their text going missing and then coming back. The
   * category is the only part that needs the list, and it's resolved
   * separately above.
   */
  useLayoutEffectOnClient(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const draft = readDraft(idRef.current);
    if (draft === null) return;

    const current = contentRef.current;
    if (
      draft.title === current.title &&
      draft.body === current.body &&
      draft.categoryId === current.category?.id
    ) {
      clearDraft(idRef.current); // matches the server — the save did land
      return;
    }

    // A draft only outlives a save that didn't land, so what's here is
    // unsaved work: restore it over the server's older copy and push it up.
    if (draft.categoryId !== current.category?.id) {
      pendingCategoryRef.current = draft.categoryId;
    }
    update({ title: draft.title, body: draft.body });
    // The body editor reads `value` only when it mounts — it owns the
    // document after that — so restored markdown has to arrive as a remount.
    setBodyRevision((n) => n + 1);
  }, []);

  async function handleClose() {
    // Never rejects, so a save that's failing can't strand the user in the
    // editor; the draft keeps their work either way.
    await autosave.flush();
    router.push("/dashboard");
    router.refresh();
  }

  async function handleCategoryChange(next: Category) {
    update({ category: next });
    await autosave.flush(); // a category change is a click, not a keystroke
  }

  /**
   * Creates a category without leaving the note. The list and the request
   * live here rather than in CategoryDropdown so the dropdown stays a pure
   * picker over `categories` (its documented contract). Rethrows so the
   * caller's input can stay open on a rejected name.
   */
  async function handleCreateCategory(name: string): Promise<Category> {
    try {
      const created = await apiFetch<Category>("/categories/", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setCategories((prev) => [...prev, created]);
      await handleCategoryChange(created);
      return created;
    } catch (err) {
      showErrorToast(apiErrorMessage(err, "Couldn't create that category."));
      throw err;
    }
  }

  async function handleDelete() {
    if (id === null) return;
    // Deleting archives now, so "this can't be undone" would be a lie — the
    // note is recoverable from the archive until the purge takes it.
    if (
      !window.confirm(
        "Move this note to the archive? It'll be deleted for good a day from now."
      )
    ) {
      return;
    }

    setDeleting(true);
    // Drop anything pending first: archived notes 404 on every detail action
    // but `restore`, so a PATCH landing after this would fail and then keep
    // retrying against a note the user has already thrown away.
    autosave.cancel();
    try {
      await apiFetch(`/notes/${id}/`, { method: "DELETE" });
      clearDraft(id);
      emitNotesChanged();
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      alert(apiErrorMessage(err, "Couldn't archive that note."));
    } finally {
      setDeleting(false);
    }
  }

  if (!category) {
    if (!categoriesLoaded) return null; // brief flash while /categories/ loads

    // Everyone is seeded with "Personal" on registration, but categories
    // can be deleted once empty — so a user who deletes all of them hits
    // this on their next new note, with nowhere to file it. Offer the
    // create form here instead of sending them off to the sidebar: this is
    // a dead end otherwise, and they'd lose whatever they came here to write.
    async function handleCreateFirst(e: FormEvent) {
      e.preventDefault();
      const name = firstCategoryName.trim();
      if (!name || creatingCategory) return;

      setCreatingCategory(true);
      try {
        await handleCreateCategory(name);
        setFirstCategoryName("");
      } catch {
        /* handleCreateCategory already reported it; keep the typed name */
      } finally {
        setCreatingCategory(false);
      }
    }

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-ink/70">
        <p>You don&apos;t have any categories yet.</p>
        <p>Create one to start a note.</p>
        <form onSubmit={handleCreateFirst} className="flex items-center gap-2">
          <input
            value={firstCategoryName}
            onChange={(e) => setFirstCategoryName(e.target.value)}
            disabled={creatingCategory}
            placeholder="Category name"
            aria-label="New category name"
            autoFocus
            className="min-w-0 rounded border border-accent/60 bg-cream px-2 py-1 text-sm text-ink outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={creatingCategory}
            className="cursor-pointer rounded border border-accent px-3 py-1 text-sm text-accent hover:bg-ink/5 disabled:opacity-50"
          >
            Create
          </button>
        </form>
      </div>
    );
  }

  const color = colorForCategory(category);

  // Save state outranks the timestamp: "Last Edited" is about the copy on the
  // server, and while a save is pending or failing that isn't what's on
  // screen. Saying so is the whole substitute for a Save button.
  const statusLabel =
    autosave.status === "saving"
      ? "Saving…"
      : autosave.status === "error"
        ? "Couldn't save — retrying…"
        : updatedAt
          ? `Last Edited: ${formatLastEdited(updatedAt)}`
          : "";

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <CategoryDropdown
          value={category}
          categories={categories}
          onChange={handleCategoryChange}
          onCreate={handleCreateCategory}
        />
        <div className="flex items-center gap-4">
          {id !== null && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Archive note"
              className="cursor-pointer text-ink/60 hover:text-ink disabled:opacity-50"
            >
              <TrashIcon className="size-5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="cursor-pointer text-ink/60 hover:text-ink"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>
      </div>

      <div
        className="flex flex-1 flex-col rounded-2xl border-2 p-8"
        style={{ backgroundColor: color.fill, borderColor: color.border }}
      >
        <div
          role="status"
          aria-live="polite"
          className={`mb-4 flex justify-end text-xs ${
            autosave.status === "error" ? "text-accent" : "text-ink/70"
          }`}
        >
          {statusLabel}
        </div>
        <input
          value={title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Note Title"
          className="mb-3 bg-transparent font-serif text-2xl font-bold text-ink placeholder:text-ink/40 outline-none"
        />
        <NoteBodyEditor
          // Remount when the note changes: the editor owns its document once
          // mounted, so a different note's body (or a restored draft) has to
          // come in as a fresh mount rather than a prop update fighting the
          // caret.
          key={`${initialNote?.id ?? "new"}:${bodyRevision}`}
          value={body}
          onChange={(markdown) => update({ body: markdown })}
          className="flex flex-1 flex-col text-ink"
        />
      </div>
    </div>
  );
}
