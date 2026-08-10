import type { Category } from "@/types/note";

export interface CategoryColor {
  /** Card/badge background */
  fill: string;
  /** Card border, dot, and dropdown accents */
  border: string;
}

/**
 * The first four categories get these, in this order. Each `border` is its
 * `fill` deepened, so the dot reads as an accent of the card rather than a
 * second color.
 *
 * Every fill is light enough for the `--color-ink` foreground the cards
 * already use to clear WCAG AA (categories.test.ts asserts the ratio, so a
 * swapped-in fill can't quietly break readability).
 *
 * Frozen because colorForCategory hands these objects straight back to
 * callers rather than rebuilding them, so a stray write would recolor a
 * category everywhere, permanently.
 */
export const FEATURED_CATEGORY_COLORS: readonly CategoryColor[] = Object.freeze(
  [
    { fill: "#EF9C66", border: "#DE7B3B" },
    { fill: "#FCDC94", border: "#DDAA3C" },
    { fill: "#C8CFA0", border: "#8F9B4B" },
    { fill: "#78ABA8", border: "#447E7A" },
  ].map((color) => Object.freeze(color))
);

function hashCategoryId(id: number): number {
  // A cheap integer hash (Fowler/Noll/Vo-ish mix) so consecutive ids don't
  // land on near-identical hues.
  let hash = id * 2654435761;
  hash ^= hash >>> 15;
  return Math.abs(hash);
}

/**
 * Categories are user-owned and freely named/created (see
 * backend/notes/models.py) — there's no fixed set of keys to hang colors off
 * of, and no color field on the backend (colors are a frontend-only concern
 * by design).
 *
 * So the first four categories take FEATURED_CATEGORY_COLORS in order, by
 * `position` — the API's per-owner index, which every call site has because
 * it rides along on the category itself. A note card only ever holds its own
 * note's category, never the user's list, so ranking by index-in-a-fetched-array
 * would color the same category differently on the dashboard than in the sidebar.
 *
 * Everything past the fourth is generated from a hash of the id: a hue spread
 * around the wheel at a pastel fill / deeper border lightness matching the
 * app's warm, muted palette. The hash is what keeps those from being a fixed
 * sequence — the fifth category isn't "the next color", it's an arbitrary one
 * — while staying stable, since the same id always hashes the same way.
 * Hashing the id rather than the position also means those colors survive a
 * category above them being deleted.
 */
export function colorForCategory(category: Pick<Category, "id" | "position">): CategoryColor {
  // Typed as possibly-undefined on purpose: it covers the out-of-range
  // position (the fifth category onwards) and the values that aren't a
  // position at all (negative, non-integer) in the same check.
  const featured: CategoryColor | undefined = Number.isInteger(category.position)
    ? FEATURED_CATEGORY_COLORS[category.position]
    : undefined;
  if (featured) return featured;

  const hue = hashCategoryId(category.id) % 360;
  return {
    fill: `hsl(${hue} 55% 84%)`,
    border: `hsl(${hue} 45% 62%)`,
  };
}
