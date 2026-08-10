"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { colorForCategory } from "@/lib/categories";
import { apiFetch, apiErrorMessage } from "@/lib/api";
import { useNotesChanged } from "@/lib/events";
import { showErrorToast } from "@/lib/toast";
import type { NoteCounts } from "@/types/note";
import {
  ArchiveIcon,
  LogoutIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  CloseIcon,
  NotesIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeCategory = searchParams.get("category");

  const [counts, setCounts] = useState<NoteCounts | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    return apiFetch<NoteCounts>("/notes/counts/")
      .then((data) => setCounts(data))
      .catch(() => {
        /* sidebar counts are a nice-to-have; ignore fetch errors */
      });
  }

  useEffect(() => {
    refresh();
    // Re-fetch whenever we navigate back to the dashboard, e.g. after
    // creating/editing/deleting a note in the editor.
  }, [pathname]);

  // Navigation isn't the only thing that changes the counts: restoring from
  // /archive leaves the route alone, so the effect above never re-runs.
  useNotesChanged(refresh);

  useEffect(() => {
    if (editingId !== null) editInputRef.current?.focus();
  }, [editingId]);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function startEditing(id: number, currentName: string) {
    setEditingId(id);
    setEditName(currentName);
  }

  async function saveRename(id: number) {
    const name = editName.trim();
    setEditingId(null);
    if (!name) return;

    const current = counts?.categories.find((c) => c.id === id);
    if (!current || current.name === name) return;

    setBusy(true);
    try {
      await apiFetch(`/categories/${id}/`, { method: "PATCH", body: JSON.stringify({ name }) });
      await refresh();
    } catch (err) {
      showErrorToast(apiErrorMessage(err, "Couldn't rename that category."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this category?")) return;

    setBusy(true);
    try {
      await apiFetch(`/categories/${id}/`, { method: "DELETE" });
      if (activeCategory === String(id)) router.push("/dashboard");
      await refresh();
    } catch (err) {
      showErrorToast(apiErrorMessage(err, "Couldn't delete that category."));
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) {
      setAdding(false);
      return;
    }

    setBusy(true);
    try {
      await apiFetch("/categories/", { method: "POST", body: JSON.stringify({ name }) });
      setNewName("");
      setAdding(false);
      await refresh();
    } catch (err) {
      showErrorToast(apiErrorMessage(err, "Couldn't create that category."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col justify-between py-10 pr-4 pl-10">
      <div>
        {/* Styled as a peer of the category rows and the Archive link below,
            not as a bold heading over the list: as a heading it read like a
            label for the categories rather than the "show everything" filter
            it actually is. */}
        <Link
          href="/dashboard"
          className={cn(
            "mb-6 flex items-center gap-2 text-sm text-ink",
            // The pathname check matters now that /archive exists: without it
            // this reads as the selected item while you're viewing the
            // archive, since no category is active there either.
            pathname === "/dashboard" && !activeCategory && "font-bold"
          )}
        >
          <NotesIcon className="size-4 shrink-0 text-ink/60" />
          All Notes
          {counts ? <span className="ml-auto shrink-0 text-ink/60">{counts.all}</span> : null}
        </Link>

        <p className="mb-3.5 text-xs font-bold tracking-wide text-ink/50 uppercase">Categories</p>
        <nav className="flex flex-col gap-3.5">
          {counts?.categories.map((category) => {
            const color = colorForCategory(category);
            const isActive = activeCategory === String(category.id);
            const isEditing = editingId === category.id;

            if (isEditing) {
              return (
                <input
                  key={category.id}
                  ref={editInputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => saveRename(category.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename(category.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="rounded border border-accent/60 bg-cream px-1.5 py-0.5 text-sm text-ink outline-none"
                />
              );
            }

            return (
              <div key={category.id} className="group flex items-center gap-2 text-sm text-ink">
                <Link
                  href={`/dashboard?category=${category.id}`}
                  className={cn(
                    "flex min-w-0 flex-1 items-center justify-between gap-2",
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
                <button
                  type="button"
                  aria-label={`Rename ${category.name}`}
                  disabled={busy}
                  onClick={() => startEditing(category.id, category.name)}
                  className="shrink-0 cursor-pointer text-ink/40 opacity-0 hover:text-ink group-hover:opacity-100 disabled:opacity-0"
                >
                  <PencilIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${category.name}`}
                  disabled={busy}
                  onClick={() => handleDelete(category.id)}
                  className="shrink-0 cursor-pointer text-ink/40 opacity-0 hover:text-ink group-hover:opacity-100 disabled:opacity-0"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              </div>
            );
          })}

          {adding ? (
            <div className="flex items-center gap-2">
              <input
                ref={addInputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleAdd}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") {
                    setNewName("");
                    setAdding(false);
                  }
                }}
                placeholder="Category name"
                className="min-w-0 flex-1 rounded border border-accent/60 bg-cream px-1.5 py-0.5 text-sm text-ink outline-none"
              />
              <button
                type="button"
                aria-label="Cancel"
                onClick={() => {
                  setNewName("");
                  setAdding(false);
                }}
                className="shrink-0 cursor-pointer text-ink/60 hover:text-ink"
              >
                <CloseIcon className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 text-sm text-accent hover:underline cursor-pointer disabled:opacity-50"
            >
              <PlusIcon className="size-3" />
              Add category
            </button>
          )}
        </nav>
      </div>

      <div className="flex flex-col gap-3.5">
        <Link
          href="/archive"
          className={cn(
            "flex items-center gap-2 text-sm text-ink",
            pathname === "/archive" && "font-bold"
          )}
        >
          <ArchiveIcon className="size-4 shrink-0 text-ink/60" />
          Archive
          {counts?.archived ? (
            <span className="ml-auto shrink-0 text-ink/60">{counts.archived}</span>
          ) : null}
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-accent hover:underline cursor-pointer"
        >
          <LogoutIcon className="size-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
