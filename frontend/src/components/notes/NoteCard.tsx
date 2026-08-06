import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { formatNoteDate } from "@/lib/date";
import { cn } from "@/lib/cn";
import type { Note } from "@/types/note";

export function NoteCard({ note }: { note: Note }) {
  const token = CATEGORIES[note.category];

  return (
    <Link
      href={`/notes/${note.id}`}
      className={cn(
        "flex flex-col rounded-2xl border-2 p-5 shadow-sm transition-shadow hover:shadow-md",
        token.fillClass,
        token.borderClass
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-sm">
        <span className="font-bold text-ink">{formatNoteDate(note.updated_at)}</span>
        <span className="text-ink/70">{token.label}</span>
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
