import { requireAuth } from "@/lib/auth";
import { NoteEditor } from "@/components/notes/NoteEditor";

export default async function NewNotePage() {
  await requireAuth();
  return <NoteEditor />;
}
