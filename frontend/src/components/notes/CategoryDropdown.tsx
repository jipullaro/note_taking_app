"use client";

import { useEffect, useRef, useState } from "react";
import { colorForCategory } from "@/lib/categories";
import type { Category } from "@/types/note";
import { ChevronDownIcon } from "@/components/ui/icons";

export function CategoryDropdown({
  value,
  categories,
  onChange,
}: {
  value: Category;
  /** The user's full category list, fetched by the caller (see
   * NoteEditor) — this component just renders/picks from it. */
  categories: Category[];
  onChange: (category: Category) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const color = colorForCategory(value);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const options = categories.filter((c) => c.id !== value.id);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-accent bg-cream px-4 py-2 text-sm text-ink cursor-pointer"
      >
        <span className="size-2.5 rounded-full" style={{ backgroundColor: color.border }} />
        {value.name}
        <ChevronDownIcon className="size-3.5 text-accent" />
      </button>

      {open && options.length > 0 && (
        <div className="absolute left-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-lg bg-cream shadow-lg ring-1 ring-ink/10">
          {options.map((category) => {
            const optionColor = colorForCategory(category);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  onChange(category);
                  setOpen(false);
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
        </div>
      )}
    </div>
  );
}
