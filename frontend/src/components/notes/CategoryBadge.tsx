import { CATEGORIES } from "@/lib/categories";
import type { CategoryKey } from "@/types/note";
import { cn } from "@/lib/cn";

export function CategoryBadge({
  category,
  className,
}: {
  category: CategoryKey;
  className?: string;
}) {
  const token = CATEGORIES[category];
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-ink", className)}>
      <span className={cn("size-2.5 rounded-full", token.dotClass)} />
      {token.label}
    </span>
  );
}
