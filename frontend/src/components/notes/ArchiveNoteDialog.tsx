"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * The confirmation both trash buttons raise (the dashboard card's and the
 * editor's). Shared so the promise made to the user is worded in exactly one
 * place: DELETE archives, so the note is recoverable from /archive until the
 * purge takes it — copy that claims it's gone for good would be a lie.
 */
export function ArchiveNoteDialog({
  open,
  noteTitle,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  /** The note's title; blank titles are allowed, so fall back to a name. */
  noteTitle: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const name = noteTitle.trim() || "Untitled note";

  return (
    <ConfirmDialog
      open={open}
      title="Move this note to the archive?"
      description={
        <>
          <span className="font-semibold text-ink">“{name}”</span> will be deleted for good a
          day from now. Until then you can restore it from the archive.
        </>
      }
      confirmLabel="Move to archive"
      busyLabel="Moving…"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
