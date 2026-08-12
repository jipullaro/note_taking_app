"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, apiErrorMessage } from "@/lib/api";
import { colorForCategory } from "@/lib/categories";
import { emitNotesChanged } from "@/lib/events";
import { showToast, showErrorToast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { TrashIcon } from "@/components/ui/icons";
import { ArchiveNoteDialog } from "./ArchiveNoteDialog";
import { NoteCardBody } from "./NoteCardBody";
import type { Note } from "@/types/note";

export function NoteCard({ note }: { note: Note }) {
  const router = useRouter();
  const color = colorForCategory(note.category);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiFetch(`/notes/${note.id}/`, { method: "DELETE" });
      // Deleting from a card leaves us on /dashboard, so the sidebar's
      // pathname-keyed effect never re-runs and router.refresh() won't reset
      // its client-state counts — tell it directly, as the archive does.
      emitNotesChanged();
      router.refresh();
      // The card just vanished from under the cursor; say where it went.
      showToast("Note moved to the archive.");
    } catch (err) {
      showErrorToast(apiErrorMessage(err, "Couldn't delete that note."));
    } finally {
      setDeleting(false);
      // Closed either way: on success the card is on its way out, and on
      // failure the toast carries the message, so keeping a dead dialog up
      // would just trap focus behind an error the user has already read.
      setConfirming(false);
    }
  }

  return (
    <div
      className="group flex flex-col rounded-2xl border-2 p-5 shadow-sm transition-shadow hover:shadow-md"
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
          onClick={() => setConfirming(true)}
          disabled={deleting}
          aria-busy={deleting}
          // Icon-only, so this is the button's whole accessible name. Naming
          // the note matters on a grid: "Delete" alone would give a screen
          // reader a list of identically-named buttons.
          aria-label={`Delete ${note.title || "untitled note"}`}
          title="Delete"
          className={cn(
            "shrink-0 cursor-pointer rounded-lg p-1.5 text-ink/40 transition-opacity",
            "hover:bg-ink/5 hover:text-ink",
            // Revealed by pointing at the card — matching the sidebar's
            // category row buttons. The extra conditions are what keep a
            // hover-only control reachable by everyone else:
            //   focus-within  — the card's link is focused, i.e. you tabbed here
            //   focus-visible — the button itself is focused
            //   hover: none   — a touch screen, where hover never happens
            "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
            "focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
            // Held open while the request is in flight, or the button would
            // fade out mid-click and leave nothing explaining the pause.
            deleting && "opacity-100"
          )}
        >
          <TrashIcon className="size-4" />
        </button>
      </div>
      <ArchiveNoteDialog
        open={confirming}
        noteTitle={note.title}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
