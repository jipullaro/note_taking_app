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
  MenuIcon,
  NotesIcon,
} from "@/components/ui/icons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  // Phones only: the sidebar is 256px of a ~390px screen, so it slides in over
  // the notes instead of standing beside them. From md up it's always open and
  // this state goes unused — the button that sets it is hidden there.
  //
  // The route it was opened on is stored alongside the flag so that navigating
  // closes it without an effect: picking a category is the whole point of
  // opening the drawer, and it should be out of the way by the time you land.
  const [menu, setMenu] = useState({ open: false, route: "" });
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

  // The query string is part of the route here: /dashboard?category=2 and
  // /dashboard are the same pathname but different sidebar selections.
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const menuOpen = menu.open && menu.route === routeKey;

  useEffect(() => {
    if (!menuOpen) return;

    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // The delete-category confirmation opens from inside the drawer and
      // handles Escape on `document`, which reaches window afterwards. Escape
      // there means "back out of the dialog", not "and take the drawer too".
      if (e.defaultPrevented) return;
      setMenu({ open: false, route: "" });
      menuButtonRef.current?.focus();
    }

    // The drawer covers the page, so the page behind it shouldn't scroll out
    // from under it on a touch drag.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Rotating a phone into landscape can cross the md breakpoint, where the
    // sidebar is a static column again and this state would otherwise be stuck
    // "open" — leaving the scroll lock on with no visible drawer to explain it.
    const desktop = window.matchMedia("(min-width: 48rem)");
    const handleBreakpoint = () => {
      if (desktop.matches) setMenu({ open: false, route: "" });
    };

    window.addEventListener("keydown", handleKeyDown);
    desktop.addEventListener("change", handleBreakpoint);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      desktop.removeEventListener("change", handleBreakpoint);
    };
  }, [menuOpen]);

  /** Dismissal by the user (backdrop, Escape, the X) rather than by navigation:
   *  focus goes back to the button that opened the drawer. */
  function closeMenu() {
    setMenu({ open: false, route: "" });
    menuButtonRef.current?.focus();
  }

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
    setBusy(true);
    try {
      await apiFetch(`/categories/${id}/`, { method: "DELETE" });
      if (activeCategory === String(id)) router.push("/dashboard");
      await refresh();
    } catch (err) {
      showErrorToast(apiErrorMessage(err, "Couldn't delete that category."));
    } finally {
      setBusy(false);
      // Closed either way, as the note dialog is: on success the row is gone,
      // and on failure the toast carries the message — a dialog left up over
      // it would only trap focus behind something already read.
      setConfirmingId(null);
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

  // Read back out of the freshly-fetched list rather than held in state, so a
  // rename that lands while the dialog is up can't leave it naming the old one.
  const confirming = counts?.categories.find((c) => c.id === confirmingId) ?? null;

  return (
    <>
      {/* The drawer's handle. Only exists below md, where the drawer does. */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink/10 bg-cream px-5 py-3 md:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMenu({ open: true, route: routeKey })}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="sidebar-nav"
          // Negative margin so the 44px touch target doesn't push the bar taller
          // than the text in it.
          className="-m-2 cursor-pointer p-2 text-ink"
        >
          <MenuIcon className="size-5" />
        </button>
        <span className="font-serif text-lg font-bold">Notes</span>
      </header>

      {/* Dimmed page behind the open drawer, and the tap target that closes it.
          Kept mounted at opacity-0 so it can fade rather than pop. */}
      <div
        onClick={closeMenu}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-ink/40 transition-opacity duration-200 md:hidden motion-reduce:transition-none",
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        id="sidebar-nav"
        className={cn(
          "z-50 flex w-64 shrink-0 flex-col justify-between bg-cream py-10 pr-4 pl-10",
          // Below md: off-canvas, sliding in over the notes. `invisible` (rather
          // than translation alone) is what keeps the closed drawer's links out
          // of the tab order; it's transitioned so it only takes effect once the
          // slide-out has finished.
          "fixed inset-y-0 left-0 overflow-y-auto transition-[transform,visibility] duration-200 motion-reduce:transition-none",
          menuOpen ? "visible translate-x-0 shadow-xl" : "invisible -translate-x-full",
          // From md up: back in the flow, always open, nothing to slide.
          "md:visible md:static md:min-h-screen md:translate-x-0 md:overflow-visible md:shadow-none"
        )}
      >
        <div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeMenu}
            aria-label="Close menu"
            className="mb-6 -ml-2 cursor-pointer p-2 text-ink/60 hover:text-ink md:hidden"
          >
            <CloseIcon className="size-5" />
          </button>

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
                    // Hover-revealed on a mouse; permanently shown on a touch
                    // screen, where there's no hover to reveal them with.
                    className="shrink-0 cursor-pointer text-ink/40 opacity-0 hover:text-ink group-hover:opacity-100 disabled:opacity-0 [@media(hover:none)]:opacity-100"
                  >
                    <PencilIcon className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${category.name}`}
                    disabled={busy}
                    onClick={() => setConfirmingId(category.id)}
                    className="shrink-0 cursor-pointer text-ink/40 opacity-0 hover:text-ink group-hover:opacity-100 disabled:opacity-0 [@media(hover:none)]:opacity-100"
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

        {confirming && (
          <ConfirmDialog
            open
            title="Delete this category?"
            description={
              <>
                <span className="font-semibold text-ink">“{confirming.name}”</span> will be gone
                for good. Notes still in it have to be moved out first; any of its notes already
                in the archive are deleted with it.
              </>
            }
            confirmLabel="Delete category"
            busyLabel="Deleting…"
            busy={busy}
            onConfirm={() => handleDelete(confirming.id)}
            onCancel={() => setConfirmingId(null)}
          />
        )}
      </aside>
    </>
  );
}
