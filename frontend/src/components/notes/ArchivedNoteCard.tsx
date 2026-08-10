"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, apiErrorMessage } from "@/lib/api";
import { colorForCategory } from "@/lib/categories";
import { emitNotesChanged } from "@/lib/events";
import { showToast, showErrorToast } from "@/lib/toast";
import { RestoreIcon } from "@/components/ui/icons";
import { NoteCardBody } from "./NoteCardBody";
import type { Note } from "@/types/note";

/**
 * An archived note. Deliberately NOT a link to the editor: the editor
 * autosaves, so merely opening an archived note would start PATCHing a note
 * the user believes is deleted. The API agrees — detail routes are scoped to
 * live notes, so /notes/<id>/ 404s while archived.
 */
export function ArchivedNoteCard({ note }: { note: Note }) {
  const router = useRouter();
  const color = colorForCategory(note.category);
  const [restoring, setRestoring] = useState(false);

  async function handleRestore() {
    setRestoring(true);
    try {
      await apiFetch(`/notes/${note.id}/restore/`, { method: "POST" });
      // The sidebar counts live in client state that router.refresh() won't
      // reset, and restoring leaves us on /archive — so tell it directly.
      emitNotesChanged();
      router.refresh();
      showToast("Note restored.");
    } catch (err) {
      showErrorToast(apiErrorMessage(err, "Couldn't restore that note."));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div
      className="flex flex-col rounded-2xl border-2 p-5 opacity-80 shadow-sm"
      style={{ backgroundColor: color.fill, borderColor: color.border }}
    >
      <NoteCardBody note={note} timestamp={note.archived_at ?? note.updated_at} />
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleRestore}
          disabled={restoring}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-ink/20 px-3 py-1.5 text-sm text-ink hover:bg-ink/5 disabled:opacity-50"
        >
          <RestoreIcon className="size-3.5" />
          {restoring ? "Restoring…" : "Restore"}
        </button>
      </div>
    </div>
  );
}
