import { formatNoteDate } from "@/lib/date";
import { NoteBody } from "./NoteBody";
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
      {/*
        max-height + overflow rather than `line-clamp-6`: line-clamp compiles to
        -webkit-box + -webkit-line-clamp, which only counts lines reliably when
        the clamped element's content is inline. The preview is a block tree now
        (<ul>, several <p>), so the clamp would misbehave. max-h-30 is the six
        text-sm lines the clamp used to allow, keeping the card's proportions.
        `whitespace-pre-line` is gone too — the renderer owns line breaks now.

        Living here rather than in NoteCard means the archive's cards get the
        same rendering; putting it back in NoteCard would leave archived notes
        showing raw "- milk" and "**bold**".
      */}
      {note.body && (
        <div className="mt-2 max-h-30 overflow-hidden text-sm text-ink/80">
          <NoteBody body={note.body} />
        </div>
      )}
    </>
  );
}
