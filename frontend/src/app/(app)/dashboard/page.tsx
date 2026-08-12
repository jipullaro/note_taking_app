import { requireAuth, redirectIfUnauthenticated } from "@/lib/auth";
import { serverApiFetch } from "@/lib/api";
import { NoteSearch } from "@/components/notes/NoteSearch";
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
    // The category filter is applied by the API above; NoteSearch narrows that
    // result further, in the browser, as the user types. "New Note" is handed
    // to it so the button and the search field share one toolbar row.
    <NoteSearch
      notes={notes}
      action={
        // Icon-only on a phone. The label and the search field's 14rem floor
        // don't fit one row there, and letting the button wrap spends a whole
        // row on it — a "+" beside the field reads better and costs nothing,
        // since the label is still the link's accessible name and its tooltip.
        <Button
          href="/notes/new"
          icon={<PlusIcon className="size-4" />}
          title="New Note"
          className="max-md:px-3"
        >
          <span className="max-md:sr-only">New Note</span>
        </Button>
      }
    />
  );
}
