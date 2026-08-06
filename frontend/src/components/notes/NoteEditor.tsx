"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import { formatLastEdited } from "@/lib/date";
import { CategoryDropdown } from "./CategoryDropdown";
import { CloseIcon, TrashIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { CategoryKey, Note } from "@/types/note";

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
  const [category, setCategory] = useState<CategoryKey>(initialNote?.category ?? "personal");
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(initialNote?.updated_at);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const latestRef = useRef({ title, body, category });

  useEffect(() => {
    latestRef.current = { title, body, category };
  }, [title, body, category]);

  const save = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current) return;

    const payload = latestRef.current;
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

  async function handleCategoryChange(next: CategoryKey) {
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

  const token = CATEGORIES[category];

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <CategoryDropdown value={category} onChange={handleCategoryChange} />
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
        className={cn(
          "flex flex-1 flex-col rounded-2xl border-2 p-8",
          token.fillClass,
          token.borderClass
        )}
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
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            scheduleSave();
          }}
          placeholder="Pour your heart out…"
          className="min-h-[50vh] flex-1 resize-none bg-transparent text-ink placeholder:text-ink/40 outline-none"
        />
      </div>
    </div>
  );
}
