import Link from "next/link";
import { colorForCategory } from "@/lib/categories";
import { formatNoteDate } from "@/lib/date";
import type { Note } from "@/types/note";
import { NoteBody } from "./NoteBody";

export function NoteCard({ note }: { note: Note }) {
  const color = colorForCategory(note.category);

  return (
    <Link
      href={`/notes/${note.id}`}
      className="flex flex-col rounded-2xl border-2 p-5 shadow-sm transition-shadow hover:shadow-md"
      style={{ backgroundColor: color.fill, borderColor: color.border }}
    >
      <div className="mb-2 flex items-center gap-2 text-sm">
        <span className="font-bold text-ink">{formatNoteDate(note.updated_at)}</span>
        <span className="text-ink/70">{note.category.name}</span>
      </div>
      <h3 className="font-serif text-xl font-bold text-ink line-clamp-2">
        {note.title || "Note Title"}
      </h3>
      {/*
        max-height + overflow rather than `line-clamp-6`: line-clamp compiles to
        -webkit-box + -webkit-line-clamp, which only counts lines reliably when
        the clamped element's content is inline. The preview is now a block tree
        (<ul>, several <p>), so the clamp would misbehave. 7.5rem is the six
        text-sm lines the clamp used to allow, keeping the card's proportions.
        `whitespace-pre-line` is gone too — the renderer owns line breaks now.
      */}
      {note.body && (
        <div className="mt-2 max-h-30 overflow-hidden text-sm text-ink/80">
          <NoteBody body={note.body} />
        </div>
      )}
    </Link>
  );
}
