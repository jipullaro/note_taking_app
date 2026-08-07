"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { colorForCategory } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { formatLastEdited } from "@/lib/date";
import { CategoryDropdown } from "./CategoryDropdown";
import { NoteBody } from "./NoteBody";
import { CloseIcon, TrashIcon } from "@/components/ui/icons";
import type { Category, Note } from "@/types/note";

const AUTOSAVE_DELAY_MS = 800;

/** Shared by the body textarea and its rendered stand-in so they occupy the same box. */
const BODY_BOX = "min-h-[50vh] flex-1 text-ink";

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
  // The body renders as markdown until it's focused, and as a raw textarea
  // while it's being typed into (a textarea can't style its own text).
  const [editingBody, setEditingBody] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const latestRef = useRef({ title, body, category });

  useEffect(() => {
    latestRef.current = { title, body, category };
  }, [title, body, category]);

  // The textarea only exists once editingBody flips, so focus has to wait for
  // it to mount. Nothing here touches autosave: the swap is presentational, and
  // blur deliberately doesn't save — the running debounce still owns that, so a
  // click away can't fire a second write on top of it.
  useEffect(() => {
    if (!editingBody) return;
    const el = bodyRef.current;
    if (!el) return;
    el.focus();
    // Programmatic focus parks the caret at offset 0; the end of the text is
    // the less surprising place to resume typing.
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editingBody]);

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
        {/*
          A <textarea> can't style its own contents, so the body swaps between
          the raw textarea (while typing) and the rendered markdown (the rest of
          the time). Both wear BODY_BOX so the swap doesn't shift the layout.
        */}
        {editingBody ? (
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              scheduleSave();
            }}
            onBlur={() => setEditingBody(false)}
            placeholder="Pour your heart out…"
            className={cn(
              BODY_BOX,
              "resize-none bg-transparent placeholder:text-ink/40 outline-none"
            )}
          />
        ) : (
          <div
            role="textbox"
            aria-multiline="true"
            aria-label="Note body"
            tabIndex={0}
            onClick={() => setEditingBody(true)}
            onFocus={() => setEditingBody(true)}
            className={cn(BODY_BOX, "cursor-text outline-none")}
          >
            {body ? (
              <NoteBody body={body} />
            ) : (
              <span className="text-ink/40">Pour your heart out…</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
