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
9. Open a note and click the trash icon → confirm → the note is deleted.
10. Click **Log out** in the sidebar → you're redirected to `/login`; visiting
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

## Backend tests

```bash
make test                    # in Docker, via pytest
make -C backend test         # locally via uv + pytest
```

Both run the same 33 tests; the local one needs Postgres reachable on
`localhost:5432` (`make up` or `docker compose up -d postgres`).

## Notes on scope / design decisions

- **Categories are user-owned**, not a fixed set — a `Category` model
  (see `backend/notes/models.py`) scoped to its owner and unique per owner,
  with notes pointing at one by FK. Every new user is seeded with a single
  "Personal" category, which is a starting point rather than a protected
  default: it can be renamed or deleted like any other. Deleting a category
  that still holds notes is refused; move or delete them first.
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
- Frontend automated tests are out of scope given the size of this
  project — the manual smoke test above is the acceptance check.
