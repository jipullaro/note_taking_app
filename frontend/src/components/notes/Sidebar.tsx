"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/categories";
import { apiFetch } from "@/lib/api";
import type { CategoryCounts } from "@/types/note";
import { LogoutIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeCategory = searchParams.get("category");

  const [counts, setCounts] = useState<CategoryCounts | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<CategoryCounts>("/notes/counts/")
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
          {CATEGORY_ORDER.map((key) => {
            const token = CATEGORIES[key];
            const isActive = activeCategory === key;
            return (
              <Link
                key={key}
                href={`/dashboard?category=${key}`}
                className={cn(
                  "flex items-center justify-between gap-4 text-sm text-ink",
                  isActive && "font-bold"
                )}
              >
                <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                  <span className={cn("size-2.5 shrink-0 rounded-full", token.dotClass)} />
                  {token.label}
                </span>
                <span className="ml-auto shrink-0 text-ink/60">{counts ? counts[key] : ""}</span>
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
