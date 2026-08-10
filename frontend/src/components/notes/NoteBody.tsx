import { cn } from "@/lib/cn";
import { renderMarkdown } from "@/lib/markdown";

/**
 * A note body rendered with its markdown-ish markup applied — shared by the
 * dashboard cards and by the editor whenever the body isn't being typed into.
 *
 * Type styling (size, color) is left to the caller so the same output can sit
 * inside a card (`text-sm text-ink/80`) or the editor (`text-ink`); this only
 * owns the spacing between blocks. Renders nothing at all for an empty body so
 * callers can decide what an empty note looks like.
 */
export function NoteBody({ body, className }: { body: string; className?: string }) {
  const blocks = renderMarkdown(body);
  if (blocks.length === 0) return null;

  return <div className={cn("space-y-2", className)}>{blocks}</div>;
}
