"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { filterNotes, normalizeQuery } from "@/lib/search";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextInput } from "@/components/ui/TextInput";
import { CloseIcon, SearchIcon } from "@/components/ui/icons";
import { NoteGrid } from "./NoteGrid";
import type { Note } from "@/types/note";

/**
 * The dashboard's note list, with a search field over it.
 *
 * The query is local component state rather than a URL param like
 * `?category=`: the category filter is served by Django (the page refetches),
 * while this one only re-renders notes that are already on the client, so
 * routing on every keystroke would add a server round-trip to something
 * instant. Keeping it in state also means the query survives the
 * `router.refresh()` a card's delete triggers — the grid re-renders from the
 * server, the search field doesn't lose what you typed.
 *
 * NoteGrid stays a plain presentational grid; this owns the filtering so the
 * archive's list can keep using its own grid unchanged.
 *
 * `action` is the toolbar's right-hand slot — the dashboard's "New Note"
 * button. It's passed in rather than rendered here so the page keeps owning
 * what that button is, while the two controls still share one row.
 */
export function NoteSearch({ notes, action }: { notes: Note[]; action?: ReactNode }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Every keystroke re-parses the markdown of every note body, so memoize on
  // the pair — typing past a match shouldn't redo work for an unchanged list.
  const matches = useMemo(() => filterNotes(notes, query), [notes, query]);
  const searching = normalizeQuery(query) !== "";

  function clearSearch() {
    setQuery("");
    // The clear button unmounts the moment the query empties, which would
    // drop focus onto <body>; put it back where the user was typing.
    inputRef.current?.focus();
  }

  return (
    <>
      {/* Search and the page action share a row; below ~14rem of room for the
          field, the action wraps under it rather than squeezing it. Phones
          don't reach that — the dashboard's button is an icon there, and the
          pair fits — so the wrap is a last resort. `justify-end` is for it:
          the field is flex-1, so justify-content has no free space to
          distribute while the two share a row, but the action alone on a
          second line would otherwise sit left of where it is everywhere else. */}
      <div className="mb-8 flex flex-wrap items-center justify-end gap-4">
        <div role="search" className="min-w-56 flex-1">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink/40" />
            <TextInput
              ref={inputRef}
              shape="pill"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") clearSearch();
              }}
              placeholder="Search notes"
              // The field has no visible label; this is its whole accessible name.
              aria-label="Search notes"
              className={cn(
                "pl-11",
                // Chrome draws its own clear "x" inside type=search, which would
                // sit next to ours; hide it and keep the one we can label.
                "[&::-webkit-search-cancel-button]:appearance-none",
                searching && "pr-11"
              )}
            />
            {searching && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                title="Clear search"
                className="absolute top-1/2 right-3.5 -translate-y-1/2 cursor-pointer rounded-full p-1 text-ink/50 hover:bg-ink/5 hover:text-ink"
              >
                <CloseIcon className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        {action}
      </div>

      {searching && matches.length === 0 ? (
        <EmptyState message={`No notes match “${query.trim()}”.`}>
          <Button onClick={clearSearch}>Clear search</Button>
        </EmptyState>
      ) : (
        <NoteGrid notes={matches} />
      )}
    </>
  );
}
