"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
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

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const latestRef = useRef({ title, body, category });

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

    const payload = { title, body, category_id: category.id };
    setSaving(true);
    try {
      if (id === null) {
        const created = await apiFetch<Note>("/notes/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setId(created.id);
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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

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

  async function handleDelete() {
    if (id === null) return;
    if (!window.confirm("Delete this note? This can't be undone.")) return;

    setDeleting(true);
    try {
      await apiFetch(`/notes/${id}/`, { method: "DELETE" });
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
    // this on their next new note, with nowhere to file it.
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-ink/70">
        <p>You don&apos;t have any categories yet.</p>
        <p>Add one from the sidebar, then come back to start a note.</p>
      </div>
    );
  }

  const color = colorForCategory(category);

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <CategoryDropdown value={category} categories={categories} onChange={handleCategoryChange} />
        <div className="flex items-center gap-4">
          {id !== null && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Delete note"
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
