"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, apiErrorMessage } from "@/lib/api";
import { emitNotesChanged } from "@/lib/events";
import { showErrorToast } from "@/lib/toast";
import { colorForCategory } from "@/lib/categories";
import { formatLastEdited } from "@/lib/date";
import { CategoryDropdown } from "./CategoryDropdown";
import { NoteBodyEditor } from "./NoteBodyEditor";
import { CloseIcon, TrashIcon } from "@/components/ui/icons";
import type { Category, Note } from "@/types/note";

const AUTOSAVE_DELAY_MS = 800;

/**
 * Shared editor for both creating and editing a note. The Figma mockup has
 * no explicit "Save" button — only a close "X" — so this autosaves
 * (debounced while typing, immediate on category change or close) rather
 * than requiring an explicit save action.
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
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Only used by the no-categories-at-all form below; the dropdown keeps its
  // own input state once there's at least one category to hang it off.
  const [firstCategoryName, setFirstCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const latestRef = useRef({ title, body, category });
  // `id` for the code that runs outside the render which set it: save()
  // reads it back after awaiting its own POST, and the unmount cleanup runs
  // after the last render, so the state alone would be a frame behind.
  const idRef = useRef(id);
  // Categories created from inside this editor while the note still didn't
  // exist. Creating one persists it immediately (POST /categories/), so a
  // category made for a note that's then abandoned would outlive it — see
  // discardUnusedCategories() below.
  const createdCategoriesRef = useRef<Category[]>([]);

  useEffect(() => {
    latestRef.current = { title, body, category };
  }, [title, body, category]);

  // Load the user's categories so a brand-new note can default to one
  // (usually "Personal", seeded on registration) and the dropdown has
  // something to offer.
  useEffect(() => {
    apiFetch<Category[]>("/categories/")
      .then((data) => {
        setCategories(data);
        setCategory((current) => current ?? data[0] ?? null);
      })
      .catch(() => {
        /* the editor still works with just the category it was loaded with */
      })
      .finally(() => setCategoriesLoaded(true));
  }, []);

  const save = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current) return;

    const { title, body, category } = latestRef.current;
    if (!category) return; // nothing to save without a category yet
    // A note that has never been saved and has nothing in it isn't a note
    // yet: picking — or creating — a category on a blank new note shouldn't
    // strand an empty note on the dashboard. Emptying a note that already
    // exists is a real edit, and still saves.
    if (id === null && !title.trim() && !body.trim()) return;

    const payload = { title, body, category_id: category.id };
    setSaving(true);
    try {
      if (id === null) {
        const created = await apiFetch<Note>("/notes/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setId(created.id);
        idRef.current = created.id;
        setUpdatedAt(created.updated_at);
      } else {
        const updated = await apiFetch<Note>(`/notes/${id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setUpdatedAt(updated.updated_at);
      }
      dirtyRef.current = false;
    } finally {
      setSaving(false);
    }
  }, [id]);

  function scheduleSave() {
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, AUTOSAVE_DELAY_MS);
  }

  /**
   * Deletes the categories this editor created that nothing ended up filed
   * under — because the note was abandoned before it was ever saved, or was
   * saved under a different category in the end.
   *
   * Only categories created here are candidates, so a pre-existing one is
   * never touched, and the category the note was saved under is kept. The
   * API is the backstop for anything else: it refuses to delete a category
   * that still has notes in it (CategoryViewSet.destroy), so one that picked
   * up a note elsewhere survives this. Failures are swallowed on purpose —
   * a category left behind is only the status quo, not worth a toast at
   * someone already on their way out of the editor.
   */
  const discardUnusedCategories = useCallback((keepalive = false) => {
    const savedUnder = idRef.current === null ? null : latestRef.current.category?.id;
    const unused = createdCategoriesRef.current.filter((c) => c.id !== savedUnder);
    createdCategoriesRef.current = [];
    if (unused.length === 0) return;

    const deletions = unused.map((category) =>
      apiFetch(`/categories/${category.id}/`, { method: "DELETE", keepalive }).catch(() => {
        /* the category stays; nothing else in the editor depends on this */
      })
    );
    // The sidebar outlives the editor and lists these, so it has to hear
    // about it. `keepalive` means the document itself is going away, and
    // there's nobody left to tell.
    if (!keepalive) Promise.all(deletions).then(() => emitNotesChanged());
  }, []);

  useEffect(() => {
    // Unmounting is where every way of leaving the editor meets: the close
    // button (which pushes to /dashboard), a sidebar link, browser back.
    // Closing the tab is the one that doesn't unmount, hence `pagehide` —
    // and there the request needs `keepalive` to outlive the document.
    function handlePageHide() {
      discardUnusedCategories(true);
    }

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      if (timerRef.current) clearTimeout(timerRef.current);
      discardUnusedCategories();
    };
  }, [discardUnusedCategories]);

  async function handleClose() {
    await save();
    router.push("/dashboard");
    router.refresh();
  }

  async function handleCategoryChange(next: Category) {
    setCategory(next);
    latestRef.current = { ...latestRef.current, category: next };
    dirtyRef.current = true;
    await save();
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
      // A category created for a note that doesn't exist yet is provisional:
      // if that note never gets saved, the category leaves with it. One
      // created while editing a saved note is the user's to keep — the note
      // is filed under it the moment it's made.
      if (idRef.current === null) createdCategoriesRef.current.push(created);
      // Routes through handleCategoryChange (rather than setCategory) so the
      // latestRef/dirtyRef sync happens and the note is saved under the new
      // category — the effect that mirrors state into latestRef hasn't
      // flushed by the time save() reads it.
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
    try {
      await apiFetch(`/notes/${id}/`, { method: "DELETE" });
      emitNotesChanged();
      router.push("/dashboard");
      router.refresh();
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
        <div className="mb-4 flex justify-end text-xs text-ink/70">
          {updatedAt ? `Last Edited: ${formatLastEdited(updatedAt)}` : saving ? "Saving…" : ""}
        </div>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleSave();
          }}
          placeholder="Note Title"
          className="mb-3 bg-transparent font-serif text-2xl font-bold text-ink placeholder:text-ink/40 outline-none"
        />
        <NoteBodyEditor
          // Remount when the note changes: the editor owns its document once
          // mounted, so a different note's body has to come in as a fresh mount
          // rather than a prop update fighting the caret.
          key={initialNote?.id ?? "new"}
          value={body}
          onChange={(markdown) => {
            setBody(markdown);
            scheduleSave();
          }}
          className="flex flex-1 flex-col text-ink"
        />
      </div>
    </div>
  );
}
