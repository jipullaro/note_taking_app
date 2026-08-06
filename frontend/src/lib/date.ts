/** Formats an ISO timestamp as "today" / "yesterday" / "July 15" for note cards. */
export function formatNoteDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();

  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOf(now).getTime() - startOf(date).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";

  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

/** Formats an ISO timestamp as "July 21, 2024 at 8:39pm" for the editor's "Last Edited" label. */
export function formatLastEdited(iso: string): string {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .toLowerCase()
    .replace(" ", "");
  return `${datePart} at ${timePart}`;
}
