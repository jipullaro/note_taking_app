import { notFound } from "next/navigation";
import { requireAuth, redirectIfUnauthenticated } from "@/lib/auth";
import { serverApiFetch, ApiError } from "@/lib/api";
import { NoteEditor } from "@/components/notes/NoteEditor";
import type { Note } from "@/types/note";

export default async function EditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const token = await requireAuth();
  const { id } = await params;

  let note: Note;
  try {
    note = await serverApiFetch<Note>(`/notes/${id}/`, token);
  } catch (err) {
    await redirectIfUnauthenticated(err);
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  return <NoteEditor initialNote={note} />;
}
