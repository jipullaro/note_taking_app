"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { colorForCategory } from "@/lib/categories";
import { apiFetch } from "@/lib/api";
import type { NoteCounts } from "@/types/note";
import { LogoutIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeCategory = searchParams.get("category");

  const [counts, setCounts] = useState<NoteCounts | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<NoteCounts>("/notes/counts/")
      .then((data) => {
        if (!cancelled) setCounts(data);
      })
      .catch(() => {
        /* sidebar counts are a nice-to-have; ignore fetch errors */
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch whenever we navigate back to the dashboard, e.g. after
    // creating/editing/deleting a note in the editor.
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col justify-between py-10 pr-4 pl-10">
      <div>
        <Link
          href="/dashboard"
          className={cn(
            "mb-5 block text-sm font-bold text-ink",
            !activeCategory && "underline decoration-accent underline-offset-4"
          )}
        >
          All Categories
        </Link>
        <nav className="flex flex-col gap-3.5">
          {counts?.categories.map((category) => {
            const color = colorForCategory(category);
            const isActive = activeCategory === String(category.id);

            return (
              <Link
                key={category.id}
                href={`/dashboard?category=${category.id}`}
                className={cn(
                  "flex items-center justify-between gap-2 text-sm text-ink",
                  isActive && "font-bold"
                )}
              >
                <span className="flex min-w-0 shrink items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color.border }}
                  />
                  <span className="truncate">{category.name}</span>
                </span>
                <span className="shrink-0 text-ink/60">{category.count}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-2 text-sm text-accent hover:underline cursor-pointer"
      >
        <LogoutIcon className="size-4" />
        Log out
      </button>
    </aside>
  );
}
