export interface Category {
  id: number;
  name: string;
}

export interface Note {
  id: number;
  title: string;
  body: string;
  category: Category;
  created_at: string;
  updated_at: string;
}

export interface CategoryCount extends Category {
  count: number;
}

/** Shape of GET /api/notes/counts/ */
export interface NoteCounts {
  categories: CategoryCount[];
  all: number;
}
