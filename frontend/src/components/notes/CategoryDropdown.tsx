"use client";

import { useEffect, useRef, useState } from "react";
import { colorForCategory } from "@/lib/categories";
import type { Category } from "@/types/note";
import { ChevronDownIcon, PlusIcon } from "@/components/ui/icons";

export function CategoryDropdown({
  value,
  categories,
  onChange,
  onCreate,
}: {
  value: Category;
  /** The user's full category list, fetched by the caller (see
   * NoteEditor) — this component just renders/picks from it. */
  categories: Category[];
  onChange: (category: Category) => void;
  /** Creates a category and returns it. The caller owns the request and the
   * category list (again, see NoteEditor); this component owns only the
   * input UI. Rejecting leaves the input open with the typed name intact so
   * the user can fix a duplicate/blank name without retyping it. */
  onCreate: (name: string) => Promise<Category>;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const color = colorForCategory(value);

  function close() {
    setOpen(false);
    setCreating(false);
    setNewName("");
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name || busy) return;

    setBusy(true);
    try {
      await onCreate(name);
      close();
    } catch {
      // The caller surfaces the message (duplicate name, blank name, …).
      // Stay open with the text still there so it can be corrected.
    } finally {
      setBusy(false);
    }
  }

  const options = categories.filter((c) => c.id !== value.id);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className="flex items-center gap-2 rounded-lg border border-accent bg-cream px-4 py-2 text-sm text-ink cursor-pointer"
      >
        <span className="size-2.5 rounded-full" style={{ backgroundColor: color.border }} />
        {value.name}
        <ChevronDownIcon className="size-3.5 text-accent" />
      </button>

      {/* No `options.length > 0` guard: a user with a single category would
          get no panel at all, which is exactly when "new category" matters
          most. The panel is always worth opening now that it can create. */}
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-lg bg-cream shadow-lg ring-1 ring-ink/10">
          {options.map((category) => {
            const optionColor = colorForCategory(category);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  onChange(category);
                  close();
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink hover:bg-ink/5 cursor-pointer"
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: optionColor.border }}
                />
                {category.name}
              </button>
            );
          })}

          {creating ? (
            // Enter to submit, deliberately not onBlur like the sidebar's
            // add-category input: the click-outside handler above listens for
            // `mousedown`, which fires before `blur`, so a blur save would race
            // an already-unmounted input and swallow the entry.
            <div className="border-t border-ink/10 px-2 py-2">
              <input
                ref={inputRef}
                value={newName}
                disabled={busy}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreate();
                  }
                  if (e.key === "Escape") close();
                }}
                placeholder="Category name"
                aria-label="New category name"
                className="block w-full min-w-0 rounded border border-accent/60 bg-cream px-2 py-1 text-sm text-ink outline-none disabled:opacity-50"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 border-t border-ink/10 px-4 py-2.5 text-left text-sm text-accent hover:bg-ink/5 cursor-pointer"
            >
              <PlusIcon className="size-3 shrink-0" />
              New category
            </button>
          )}
        </div>
      )}
    </div>
  );
}
