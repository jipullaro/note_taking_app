import Link from "next/link";
import { colorForCategory } from "@/lib/categories";
import { formatNoteDate } from "@/lib/date";
import type { Note } from "@/types/note";

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
      {note.body && (
        <p className="mt-2 line-clamp-6 whitespace-pre-line text-sm text-ink/80">{note.body}</p>
      )}
    </Link>
  );
}
