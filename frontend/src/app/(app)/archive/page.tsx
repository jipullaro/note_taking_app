import { requireAuth, redirectIfUnauthenticated } from "@/lib/auth";
import { serverApiFetch } from "@/lib/api";
import { ArchiveGrid } from "@/components/notes/ArchiveGrid";
import type { Note } from "@/types/note";

export default async function ArchivePage() {
  const token = await requireAuth();

  let notes: Note[];
  try {
    notes = await serverApiFetch<Note[]>("/notes/?archived=true", token);
  } catch (err) {
    await redirectIfUnauthenticated(err);
    throw err;
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-ink">Archive</h1>
        <p className="mt-1 text-sm text-ink/70">
          Deleted notes wait here, then are removed for good a day after they were archived.
        </p>
      </div>
      <ArchiveGrid notes={notes} />
    </>
  );
}
