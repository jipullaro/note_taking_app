# Notes

A cozy little note-taking app: register/login, jot down notes into four fixed
categories (Personal, School, Random Thoughts, Drama), and manage them from a
dashboard.

## Stack

- **Backend**: Python, Django + Django REST Framework, PostgreSQL, JWT auth
  (`djangorestframework-simplejwt`)
- **Frontend**: React + Next.js (App Router, TypeScript), Tailwind CSS
- **Infra**: Docker Compose (postgres + backend + frontend)

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
   dropped straight into `/dashboard` (empty state visible).
2. Log out, then log back in at `/login` with the same credentials.
3. Click **+ New Note**, type a title/body, pick a category from the
   dropdown → close it (X) → the note appears on the dashboard as a card in
   that category's color.
4. Click the note card → edit the title/body/category → close → changes are
   reflected on the dashboard, and the sidebar's per-category counts update.
5. Click a category in the sidebar → the grid filters to just that
   category; click **All Categories** to clear the filter.
6. Open a note and click the trash icon → confirm → the note is deleted.
7. Click **Log out** in the sidebar → you're redirected to `/login`; visiting
   `/dashboard` directly now redirects back to `/login`.

## Backend tests

```bash
docker compose exec backend python manage.py test
```

(Or locally, from `backend/`, with a Python 3.12 venv and `pip install -r requirements.txt` — you'll need a local Postgres or to point `POSTGRES_HOST` at the one in `docker compose up postgres`.)

## Notes on scope / design decisions

- **Categories are fixed**, not user-creatable — implemented as a
  `choices` field on `Note` (see `backend/notes/models.py`), not a separate
  DB table. Color tokens for each category live only on the frontend
  (`frontend/src/lib/categories.ts`); the backend never returns color data.
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
