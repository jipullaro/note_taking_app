export interface Category {
  id: number;
  name: string;
  /**
   * 0-based index among the owner's own categories, oldest first. Served by
   * the API (the id can't stand in for it — that sequence is global across
   * users); the first few positions get a fixed palette, see lib/categories.ts.
   */
  position: number;
}

export interface Note {
  id: number;
  title: string;
  body: string;
  category: Category;
  created_at: string;
  updated_at: string;
  /** When the note was archived; null for live notes. */
  archived_at: string | null;
}

export interface CategoryCount extends Category {
  count: number;
}

/** Shape of GET /api/notes/counts/ */
export interface NoteCounts {
  categories: CategoryCount[];
  all: number;
  /** Archived notes are a flat bucket, not broken down per category. */
  archived: number;
}
