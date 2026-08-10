# Notes

A cozy little note-taking app: register/login, jot down notes, sort them into
categories you create and name yourself, and manage the whole lot from a
dashboard.

## Stack

- **Backend**: Python, Django + Django REST Framework, PostgreSQL, JWT auth
  (`djangorestframework-simplejwt`)
- **Frontend**: React + Next.js (App Router, TypeScript), Tailwind CSS
- **Infra**: Docker Compose (postgres + backend + frontend)
- **Tooling**: uv (backend deps), ruff (lint + format), pytest, eslint,
  pre-commit

## Quickstart

```bash
cp .env.example .env      # fill in real secrets (at least DJANGO_SECRET_KEY, POSTGRES_PASSWORD)
docker compose up --build
```

Then open **http://localhost:3000**.

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/
- Django admin: http://localhost:8000/admin/ (create a superuser first: `docker compose exec backend python manage.py createsuperuser`)

## Manual smoke test

1. Visit `/register`, create an account with an email + password → you're
   dropped straight into `/dashboard` (empty state visible, with a single
   "Personal" category in the sidebar).
2. Log out, then log back in at `/login` with the same credentials.
3. Click **Add category** in the sidebar, type a name, press Enter → it
   appears with its own color. Try adding it a second time → the duplicate
   is rejected with a message.
4. Hover the category → rename it with the pencil icon → the color stays
   the same (colors key off id, not name).
5. Click **+ New Note**, type a title/body, pick a category from the
   dropdown → close it (X) → the note appears on the dashboard as a card in
   that category's color.
6. Click the note card → edit the title/body/category → close → changes are
   reflected on the dashboard, and the sidebar's per-category counts update.
7. Open a note, type a few words, and reload immediately — before the status
   line settles back to "Last Edited". The words are still there, restored
   from the local draft. Now set DevTools to offline and type again: the
   status line says it couldn't save and is retrying, the text still survives
   a reload, and going back online sends it without further prompting.
8. Click a category in the sidebar → the grid filters to just that
   category; click **All Categories** to clear the filter.
9. Try deleting a category that has notes in it (trash icon) → refused with
   a message. Delete an empty one → it disappears.
10. Open a note and click the trash icon → the confirm says it moves to the
    archive → accept → the note leaves the dashboard and the category count
    drops.
11. Click **Archive** at the bottom of the sidebar → the note is there, dimmed,
    dated by when it was archived, with no link into the editor. Click
    **Restore** → it disappears from the archive and the sidebar's archive
    count drops without a page navigation.
12. Back on the dashboard, the restored note is in its category again.
13. Click **Log out** in the sidebar → you're redirected to `/login`; visiting
    `/dashboard` directly now redirects back to `/login`.

## Development

Both Makefiles print their targets with a bare `make help`.

The root `Makefile` drives the whole stack through Docker — `make up`,
`make test`, `make migrate`, `make clean` (the last one drops the Postgres
volume, which is what you want after a migration is rewritten in place).

`backend/Makefile` is a faster loop that skips the container: `make -C
backend install` syncs dependencies with uv, then `test` / `migrate` / `run`
work against the same Postgres, which compose publishes on `localhost:5432`.
It reads credentials from the same `.env`, so there's one source of truth.

Linting and formatting run automatically on commit once you've run
`pre-commit install` — ruff over `backend/`, eslint over `frontend/`.

## Tests

```bash
make test                    # backend, in Docker
make -C backend test         # backend, locally via uv + pytest
npm --prefix frontend test   # frontend, via vitest
```

The two backend commands run the same suite; the local one needs Postgres
reachable on `localhost:5432` (`make up` or `docker compose up -d postgres`).
The frontend suite needs neither Postgres nor a running backend.

## Notes on scope / design decisions

- **Categories are user-owned**, not a fixed set — a `Category` model
  (see `backend/notes/models.py`) scoped to its owner and unique per owner,
  with notes pointing at one by FK. Every new user is seeded with a single
  "Personal" category, which is a starting point rather than a protected
  default: it can be renamed or deleted like any other. Deleting a category
  that still holds *live* notes is refused; move or delete them first.
  Archived notes don't block it — they're already on a countdown, so
  blocking would strand the user behind a message about notes they can't
  see, and it would make restoring into a since-deleted category possible.
  They go down with the category via CASCADE.
- **Deleting a note archives it** rather than dropping the row: `DELETE`
  sets `Note.archived_at` and still replies `204`, so the frontend contract
  is unchanged, but the note is recoverable via
  `POST /api/notes/<id>/restore/`. `Note.archive()`/`restore()` save with
  `update_fields=["archived_at"]` so `updated_at`'s `auto_now` doesn't fire
  — archiving isn't an edit, and shouldn't bump "Last Edited".
- **The `Note` default manager stays unfiltered** — it does *not* hide
  archived rows. A filtering default manager would hide archived notes from
  the purge job that exists to delete them, and would silently redefine
  `category.notes` as "live notes only" while Django's cascade collector
  (which uses `_base_manager`) kept disagreeing. Filtering is explicit and
  named at the call site instead: `Note.objects.active()` / `.archived()` /
  `.purgeable(before=...)`.
- **Category colors are a frontend concern** — the backend stores and
  returns none. With no fixed key set to hang a palette off of,
  `colorForCategory()` (`frontend/src/lib/categories.ts`) derives a hue from
  the category id, keyed by id rather than name so renaming one doesn't
  recolor it.
- **Auth**: JWTs are stored as httpOnly cookies set by Next.js Route
  Handlers (`frontend/src/app/api/auth/*`), never exposed to client-side
  JS. All authenticated app traffic goes through a same-origin proxy route
  (`frontend/src/app/api/proxy/[...path]`) that attaches the token and
  transparently refreshes it once on a 401.
- **Note editor autosave**: the Figma mockup has no explicit "Save" button
  (only a close "X"), so the editor autosaves rather than requiring an
  explicit save action. That makes *when to send* a design problem in its
  own right, and it's split in two:
  - `frontend/src/lib/autosave.ts` decides when to call the API. It debounces
    800ms while typing, but with a **5s ceiling** — a plain trailing debounce
    only fires once the user pauses, so someone typing without a gap saves
    nothing at all, and the unsaved window is unbounded. It keeps **one
    request in flight at a time**: overlapping saves are how a brand-new note
    gets `POST`ed twice (the id isn't known until the first `POST` replies)
    and how an older body lands after a newer one, so edits made mid-request
    are coalesced into a single follow-up instead of a second concurrent
    save. Failures back off and retry (1s/3s/10s/30s) rather than
    disappearing, and pending work is flushed when the page is hidden or the
    editor is navigated away from — `keepalive`, since the page may be on its
    way out. Note that leaving via a sidebar link doesn't unmount-then-idle
    the way it might look: Next keeps client segments alive across
    navigation, so the flush is what gets that edit sent.
  - `frontend/src/lib/drafts.ts` mirrors the editor into `localStorage` on
    every change. Autosaving always leaves a window where the screen is ahead
    of the server — the debounce, a request in flight, a failed save waiting
    on its backoff — and a synchronous local write can't fail the way a
    request can. A draft is deleted the moment the same content lands on the
    server, which gives its presence a meaning: it says "this was never
    saved". That invariant is what lets the editor restore a draft on load
    without having to work out which copy is newer. The restore runs in a
    layout effect, before the browser paints — gating it on the `/categories/`
    fetch (which only the draft's *category* actually needs) meant a reload
    mid-edit showed the server's older copy first and swapped the draft in a
    moment later, so the user watched their text go missing and come back.

  The status line (`Saving… / Couldn't save — retrying… / Last Edited`) is
  the whole substitute for the Save button the mockup doesn't have, so it
  reports save state ahead of the timestamp — "Last Edited" describes the
  copy on the server, which isn't what's on screen while a save is pending.

  Three alternatives were weighed and rejected. An **explicit Save button**
  is the cleanest mental model and has no races at all, but it's the one
  thing the mockup rules out. **WebSockets** (Django Channels — the Redis
  channel layer would be free, since Celery already needs a broker) would
  replace N requests with one connection, and a **CRDT** (Yjs +
  `@tiptap/extension-collaboration`, which the ProseMirror body would take
  fairly cleanly) would give tiny deltas, offline editing and conflict-free
  merges. Both only pay for themselves if the goal is multi-device or
  collaborative editing; for a single-user note app they're infrastructure
  without a customer, and the CRDT additionally makes the Ydoc canonical and
  demotes the stored markdown to a derived projection. Worth revisiting if
  live collaboration is ever on the table.
- **Delete and logout affordances** (trash icon in the editor, "Log out" in
  the sidebar) aren't shown in the Figma exports but were added since
  they're required functionality.
- **Frontend tests** run on Vitest + React Testing Library (`npm test` from
  `frontend/`). `next/navigation` has no implementation outside a Next request
  context, so client components under test mock it via `vi.mock("next/navigation")`
  — the stand-in and its helpers live in `frontend/src/test/next-navigation.ts`.
  jsdom is also missing two things the editor needs, both stubbed in
  `frontend/src/test/setup.ts`: the geometry APIs ProseMirror measures the
  selection with (it runs no layout engine), and `localStorage`, which jsdom
  30 no longer implements itself. The latter matters more than it looks —
  `lib/drafts` treats a missing store as "no drafts available" rather than
  crashing, so without the stub every draft test would pass while asserting
  nothing. The manual smoke test above still covers what jsdom can't judge.
