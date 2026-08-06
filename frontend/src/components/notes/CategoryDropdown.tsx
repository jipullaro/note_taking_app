"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/categories";
import type { CategoryKey } from "@/types/note";
import { ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export function CategoryDropdown({
  value,
  onChange,
}: {
  value: CategoryKey;
  onChange: (category: CategoryKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const token = CATEGORIES[value];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-accent bg-cream px-4 py-2 text-sm text-ink cursor-pointer"
      >
        <span className={cn("size-2.5 rounded-full", token.dotClass)} />
        {token.label}
        <ChevronDownIcon className="size-3.5 text-accent" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-lg bg-cream shadow-lg ring-1 ring-ink/10">
          {CATEGORY_ORDER.filter((key) => key !== value).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink hover:bg-ink/5 cursor-pointer"
            >
              <span className={cn("size-2.5 rounded-full", CATEGORIES[key].dotClass)} />
              {CATEGORIES[key].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
