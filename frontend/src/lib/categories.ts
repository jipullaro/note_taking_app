import type { Category } from "@/types/note";

export interface CategoryColor {
  /** Card/badge background */
  fill: string;
  /** Card border, dot, and dropdown accents */
  border: string;
}

function hashCategoryId(id: number): number {
  // A cheap integer hash (Fowler/Noll/Vo-ish mix) so consecutive ids don't
  // land on near-identical hues.
  let hash = id * 2654435761;
  hash ^= hash >>> 15;
  return Math.abs(hash);
}

/**
 * Categories are user-owned and freely named/created (see
 * backend/notes/models.py) — there's no fixed set of keys to hang colors
 * off of, and no color field on the backend (colors are a frontend-only
 * concern by design). So every category, including the ones seeded by
 * default, gets a color procedurally generated from its id: a hue spread
 * around the wheel, rendered at a pastel fill / deeper border lightness
 * that matches the app's warm, muted palette. Keyed by id (not name) so a
 * category's color stays stable even if it's renamed.
 */
export function colorForCategory(category: Pick<Category, "id">): CategoryColor {
  const hue = hashCategoryId(category.id) % 360;
  return {
    fill: `hsl(${hue} 55% 84%)`,
    border: `hsl(${hue} 45% 62%)`,
  };
}
