import Link from "next/link";
import { colorForCategory } from "@/lib/categories";
import { NoteCardBody } from "./NoteCardBody";
import type { Note } from "@/types/note";

export function NoteCard({ note }: { note: Note }) {
  const color = colorForCategory(note.category);

  return (
    <Link
      href={`/notes/${note.id}`}
      className="flex flex-col rounded-2xl border-2 p-5 shadow-sm transition-shadow hover:shadow-md"
      style={{ backgroundColor: color.fill, borderColor: color.border }}
    >
      <NoteCardBody note={note} />
    </Link>
  );
}
