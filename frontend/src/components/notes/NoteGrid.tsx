import { NoteCard } from "./NoteCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Note } from "@/types/note";

export function NoteGrid({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
    </div>
  );
}
