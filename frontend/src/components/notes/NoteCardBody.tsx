import { formatNoteDate } from "@/lib/date";
import type { Note } from "@/types/note";

/**
 * The visual innards of a note card, with no wrapper of its own.
 *
 * Split out because the two cards need different wrappers: a live note is a
 * Link to the editor, while an archived one carries a Restore button — and a
 * <button> can't be nested inside an <a>. Keeping the contents here means the
 * two can't drift apart visually.
 */
export function NoteCardBody({ note, timestamp }: { note: Note; timestamp?: string }) {
  return (
    <>
      <div className="mb-2 flex items-center gap-2 text-sm">
        <span className="font-bold text-ink">{formatNoteDate(timestamp ?? note.updated_at)}</span>
        <span className="text-ink/70">{note.category.name}</span>
      </div>
      <h3 className="font-serif text-xl font-bold text-ink line-clamp-2">
        {note.title || "Note Title"}
      </h3>
      {note.body && (
        <p className="mt-2 line-clamp-6 whitespace-pre-line text-sm text-ink/80">{note.body}</p>
      )}
    </>
  );
}
