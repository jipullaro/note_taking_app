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
7. Click a category in the sidebar → the grid filters to just that
   category; click **All Categories** to clear the filter.
8. Try deleting a category that has notes in it (trash icon) → refused with
   a message. Delete an empty one → it disappears.
9. Open a note and click the trash icon → the confirm says it moves to the
    archive → accept → the note leaves the dashboard and the category count
    drops.
10. Click **Archive** at the bottom of the sidebar → the note is there, dimmed,
    dated by when it was archived, with no link into the editor. Click
    **Restore** → it disappears from the archive and the sidebar's archive
    count drops without a page navigation.
11. Back on the dashboard, the restored note is in its category again.
12. Click **Log out** in the sidebar → you're redirected to `/login`; visiting
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

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull
request, in three parallel jobs:

- **Lint** — `pre-commit run --all-files`. CI deliberately goes through
  pre-commit instead of calling ruff and eslint itself, so there's one
  definition of "lint" and the hook versions pinned in
  `.pre-commit-config.yaml` are the ones that run.
- **Backend** — `makemigrations --check` (catches a model edit with no
  migration) then `pytest`, against a Postgres 16 service container.
- **Frontend** — `vitest`, `tsc --noEmit`, then `next build`.

## Deploying the frontend to Vercel

`vercel.json` at the repo root points Vercel at `frontend/`, so importing
this repo needs no dashboard build configuration. One setting is required:

| Env var | Value |
| --- | --- |
| `BACKEND_INTERNAL_URL` | Public HTTPS URL of the Django API, no trailing slash |

Set it in **Project → Settings → Environment Variables**. Everything
server-side (`lib/api.ts`, `lib/auth.ts`, the `/api/auth/*` and
`/api/proxy/*` route handlers) reads it, and it falls back to
`http://localhost:8000` if unset — which on Vercel means every request
fails. It's read only on the server, so the API URL is never shipped to the
browser.

If Vercel's framework detection trips over there being no `package.json` at
the repo root, the alternative is to delete `vercel.json` and set **Root
Directory** to `frontend` in the project settings instead — Next.js is
zero-config from there. Pick one or the other: a Root Directory of
`frontend` makes Vercel look for `frontend/vercel.json` and ignore the root
one entirely.

Vercel only hosts the Next.js app. **Django, Postgres, Redis and the Celery
worker/beat need separate hosting** (any container platform — the existing
`backend/Dockerfile` is what you'd deploy), and that deployment has to allow
the Vercel domain: add it to `CORS_ALLOWED_ORIGINS` and `ALLOWED_HOSTS`.
`config.settings.dev` hardcodes `localhost:3000` and `DEBUG = True`, so a
real deployment wants a `config/settings/prod.py` alongside it.

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
  (only a close "X"), so the editor autosaves — debounced while typing,
  immediate on category change or close — rather than requiring an
  explicit save action.
- **Delete and logout affordances** (trash icon in the editor, "Log out" in
  the sidebar) aren't shown in the Figma exports but were added since
  they're required functionality.
- **Frontend tests** run on Vitest + React Testing Library (`npm test` from
  `frontend/`). `next/navigation` has no implementation outside a Next request
  context, so client components under test mock it via `vi.mock("next/navigation")`
  — the stand-in and its helpers live in `frontend/src/test/next-navigation.ts`.
  The manual smoke test above still covers what jsdom can't judge.
