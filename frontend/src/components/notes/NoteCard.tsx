"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, apiErrorMessage } from "@/lib/api";
import { colorForCategory } from "@/lib/categories";
import { emitNotesChanged } from "@/lib/events";
import { TrashIcon } from "@/components/ui/icons";
import { NoteCardBody } from "./NoteCardBody";
import type { Note } from "@/types/note";

export function NoteCard({ note }: { note: Note }) {
  const router = useRouter();
  const color = colorForCategory(note.category);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    // Same promise the editor's trash button makes: DELETE archives, so the
    // note is recoverable from /archive until the purge takes it.
    if (
      !window.confirm(
        "Move this note to the archive? It'll be deleted for good a day from now."
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      await apiFetch(`/notes/${note.id}/`, { method: "DELETE" });
      // Deleting from a card leaves us on /dashboard, so the sidebar's
      // pathname-keyed effect never re-runs and router.refresh() won't reset
      // its client-state counts — tell it directly, as the archive does.
      emitNotesChanged();
      router.refresh();
    } catch (err) {
      alert(apiErrorMessage(err, "Couldn't delete that note."));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="flex flex-col rounded-2xl border-2 p-5 shadow-sm transition-shadow hover:shadow-md"
      style={{ backgroundColor: color.fill, borderColor: color.border }}
    >
      {/*
        The link stops at the body rather than wrapping the whole card: a
        <button> can't be nested inside an <a>, and an overlay link would make
        every delete click a navigation too. `flex-1` keeps the card's blank
        space clickable, so the open target is everything but the button.
      */}
      <Link href={`/notes/${note.id}`} className="flex flex-1 flex-col">
        <NoteCardBody note={note} />
      </Link>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          // Every card carries one of these, so the visible "Delete" alone
          // would give a screen reader a list of identical buttons.
          aria-label={`Delete ${note.title || "untitled note"}`}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-ink/20 px-3 py-1.5 text-sm text-ink hover:bg-ink/5 disabled:opacity-50"
        >
          <TrashIcon className="size-3.5" />
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
