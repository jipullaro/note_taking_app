import { parseMarkdown, type InlineNode } from "@/lib/markdown";
import type { Note } from "@/types/note";

/**
 * Filtering notes by a typed query, for the dashboard's search field.
 *
 * The match is a plain case-insensitive substring over a note's title and
 * body. The body is run through the markdown parser first (see lib/markdown)
 * rather than searched raw, so the haystack is the text the user actually
 * sees on the card: a note reading "- buy **milk**" matches "buy milk", and
 * nobody has to type asterisks to find their own note.
 *
 * Filtering happens in the browser, not in Django. The dashboard already
 * fetches the user's whole (unpaginated) note list to render the grid, so the
 * matches are all in memory — a server round-trip per keystroke would buy
 * nothing but latency. If the list ever grows a pagination or a
 * search-the-archive-too story, that calculus changes and this belongs behind
 * a `?search=` query param on the API instead.
 */

function inlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => (node.type === "text" ? node.value : inlineText(node.children)))
    .join("");
}

/** A note's title and body flattened to one lower-cased, marker-free string. */
export function noteSearchText(note: Note): string {
  const bodyLines = parseMarkdown(note.body).flatMap((block) =>
    block.type === "list" ? block.items.map(inlineText) : block.lines.map(inlineText)
  );
  return [note.title, ...bodyLines].join("\n").toLowerCase();
}

/**
 * The query as it's compared: trimmed and lower-cased. An empty result means
 * "no query" — surrounding whitespace alone shouldn't filter anything out.
 */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** The notes matching `query`, in their original order. Returns them all for an empty query. */
export function filterNotes(notes: Note[], query: string): Note[] {
  const needle = normalizeQuery(query);
  if (!needle) return notes;
  return notes.filter((note) => noteSearchText(note).includes(needle));
}
