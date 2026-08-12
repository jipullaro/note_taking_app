import { ArchivedNoteCard } from "./ArchivedNoteCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Note } from "@/types/note";

export function ArchiveGrid({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return <EmptyState message="Nothing archived. Deleted notes rest here for a day." />;
  }

  return (
    // auto-rows-fr keeps every card the same height, as on the dashboard.
    <div className="grid auto-rows-fr grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {notes.map((note) => (
        <ArchivedNoteCard key={note.id} note={note} />
      ))}
    </div>
  );
}
