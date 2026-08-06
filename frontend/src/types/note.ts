export type CategoryKey = "personal" | "school" | "random_thoughts" | "drama";

export interface Note {
  id: number;
  title: string;
  body: string;
  category: CategoryKey;
  created_at: string;
  updated_at: string;
}

export type NoteDraft = Partial<Pick<Note, "title" | "body" | "category">>;

export type CategoryCounts = Record<CategoryKey, number> & { all: number };
