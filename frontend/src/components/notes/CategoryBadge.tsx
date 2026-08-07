import { colorForCategory } from "@/lib/categories";
import type { Category } from "@/types/note";
import { cn } from "@/lib/cn";

export function CategoryBadge({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  const color = colorForCategory(category);
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-ink", className)}>
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color.border }} />
      {category.name}
    </span>
  );
}
