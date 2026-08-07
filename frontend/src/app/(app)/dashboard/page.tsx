import { requireAuth, redirectIfUnauthenticated } from "@/lib/auth";
import { serverApiFetch } from "@/lib/api";
import { NoteGrid } from "@/components/notes/NoteGrid";
import { Button } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/icons";
import type { Note } from "@/types/note";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const token = await requireAuth();
  const { category } = await searchParams;

  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  let notes: Note[];
  try {
    notes = await serverApiFetch<Note[]>(`/notes/${query}`, token);
  } catch (err) {
    await redirectIfUnauthenticated(err);
    throw err;
  }

  return (
    <>
      <div className="mb-8 flex justify-end">
        <Button href="/notes/new" icon={<PlusIcon className="size-4" />}>
          New Note
        </Button>
      </div>
      <NoteGrid notes={notes} />
    </>
  );
}
