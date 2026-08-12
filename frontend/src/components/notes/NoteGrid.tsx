import { NoteCard } from "./NoteCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Note } from "@/types/note";

export function NoteGrid({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return <EmptyState />;
  }

  return (
    // auto-rows-fr, not the default auto rows: an auto row is only as tall as
    // its own tallest card, so a row of short notes came out visibly smaller
    // than the row above it. Equal fr rows size every row to the tallest card
    // in the grid, which the card's clamped title and capped body bound.
    <div className="grid auto-rows-fr grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
    </div>
  );
}
