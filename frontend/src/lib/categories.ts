import type { CategoryKey } from "@/types/note";

interface CategoryToken {
  key: CategoryKey;
  label: string;
  fillClass: string;
  borderClass: string;
  dotClass: string;
}

/**
 * Single source of truth for category presentation on the frontend.
 * Keys must mirror backend/notes/models.py Note.Category exactly.
 * Colors live only here — the backend never returns color data.
 */
export const CATEGORIES: Record<CategoryKey, CategoryToken> = {
  random_thoughts: {
    key: "random_thoughts",
    label: "Random Thoughts",
    fillClass: "bg-category-random-fill",
    borderClass: "border-category-random-border",
    dotClass: "bg-category-random-border",
  },
  school: {
    key: "school",
    label: "School",
    fillClass: "bg-category-school-fill",
    borderClass: "border-category-school-border",
    dotClass: "bg-category-school-border",
  },
  personal: {
    key: "personal",
    label: "Personal",
    fillClass: "bg-category-personal-fill",
    borderClass: "border-category-personal-border",
    dotClass: "bg-category-personal-border",
  },
  drama: {
    key: "drama",
    label: "Drama",
    fillClass: "bg-category-drama-fill",
    borderClass: "border-category-drama-border",
    dotClass: "bg-category-drama-border",
  },
};

export const CATEGORY_ORDER: CategoryKey[] = [
  "random_thoughts",
  "school",
  "personal",
  "drama",
];
