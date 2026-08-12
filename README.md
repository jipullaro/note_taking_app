# Notes

A cozy little note-taking app: register/login, jot down notes, sort them into
categories you create and name yourself, and manage the whole lot from a
dashboard.

## Stack

- **Backend**: Python, Django + Django REST Framework, PostgreSQL, JWT auth
  (`djangorestframework-simplejwt`)
- **Frontend**: React + Next.js (App Router, TypeScript), Tailwind CSS
- **Infra**: Docker Compose locally (postgres + redis + backend + worker + beat +
  frontend); Vercel in production (see "Deploying to Vercel")
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

## Deploying to Vercel

Both halves ship as **one Vercel project, one deployment, one domain**, using
[Services](https://vercel.com/docs/services) — Vercel's model for a polyglot
monorepo. `vercel.json` at the repo root defines both:

| Service | Root | Framework | Public paths |
| --- | --- | --- | --- |
| `frontend` | `frontend/` | Next.js | everything not claimed below |
| `backend` | `backend/` | Django (auto-detected) | `/backend/*`, `/static/*` |

Each service is built separately and they share the deployment, so there's
one domain, one set of environment variables and one firewall/protection
surface. Import the repo once; no Root Directory to configure.

### Routing, and why the API lives under `/backend`

The obvious split — Django at `/api/*` — is the one thing that *can't* work
here. The Next.js app already owns `/api/auth/*` and `/api/proxy/*`, and
those route handlers are what keep JWTs in httpOnly cookies and out of
browser JS. Routing `/api/*` to Django would shadow them and break the auth
design. So Django is published under `/backend/*` instead.

A service receives the **original** request path — Vercel does not strip the
matched prefix on the way in. So `/backend/api/notes/` arrives at Django as
`/backend/api/notes/`, and Django has to own that path for real.

It does: `URL_PREFIX` (`config/settings/base.py`) nests the entire URLconf
under the prefix, empty by default and `backend` under `config.settings.prod`.
Everything therefore lives at `/backend/…`, **the admin included** — it's at
`/backend/admin/`, not `/admin/`.

Mounting the prefix rather than rewriting the path at the edge is the
load-bearing choice. Because it's a genuine URLconf prefix, `reverse()`
returns the URL a browser can actually request, so the admin's own login
redirect stays inside the prefix instead of landing on the frontend's
catch-all. No `FORCE_SCRIPT_NAME`, no edge rewriting, and it's testable
locally: `notes/tests/test_url_prefix.py` covers it, and
`test_cron.py` asserts the prefix in `vercel.json` and the one in the
production settings are the same string.

> An earlier version routed `/backend/*` through a `request.path` transform
> that stripped the prefix, leaving Django unprefixed. The transform silently
> did nothing on deploy: every API call 404'd while `/admin/` worked, because
> only the prefixed paths depended on it. If you reintroduce edge rewriting,
> verify it against a real deployment first — nothing local can catch that.

`/static/*` is routed to the backend without any prefix, because Django's
`STATIC_URL` is `/static/` and the admin's templates reference it directly.

Routing into a service is final — if nothing inside matches, you get that
service's 404, not a fallback to the other service.

### Environment variables

| Env var | Required | Value |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | yes | Long random string. Startup fails without it. |
| `DATABASE_URL` | yes | Postgres connection string — use the provider's **pooled** endpoint |
| `CRON_SECRET` | yes | Random string. Vercel sends it to the cron endpoint; unset, that endpoint refuses everything. |
| `BACKEND_INTERNAL_URL` | yes | `https://<your-domain>/backend` — the frontend's server-side code appends `/api/…` to it |
| `DJANGO_ALLOWED_HOSTS` | only for custom domains | Comma-separated. `*.vercel.app` hosts come from Vercel's own env vars. |
| `DJANGO_URL_PREFIX` | no | Overrides the mount point, default `backend`. Change it and the `rewrites` and `crons` paths in `vercel.json` must move with it. |
| `CORS_ALLOWED_ORIGINS` | rarely | Frontend and backend are now same-origin, so browser CORS isn't in play. |

Set `DJANGO_SECRET_KEY` for all three environments (Production, Preview,
Development) — `vercel dev` runs the production settings module too.

Anything running on Vercel gets `config.settings.prod` automatically: every
entrypoint defaults to it when the `VERCEL` env var is present, and
`config.settings.dev` refuses to load there rather than risk shipping
`DEBUG = True` and `ALLOWED_HOSTS = ["*"]`. **Don't set
`DJANGO_SETTINGS_MODULE` on Vercel.**

Postgres comes from a marketplace integration (Neon, Supabase, …), which
sets `DATABASE_URL`; `config/settings/base.py` accepts either that or the
`POSTGRES_*` variables compose uses. `CONN_MAX_AGE` defaults to 0 on purpose:
every concurrent Function instance holds its own connection, so pooling
belongs to the provider's pooler, not to Django.

### Migrations

`backend/build.py` runs `migrate` during the build, wired up by
`[tool.vercel.scripts]` in `backend/pyproject.toml`. Vercel runs it after
installing dependencies and before the deployment serves traffic — the only
window where the schema can move ahead of the code that needs it. A failed
migration fails the build rather than shipping.

**Production deployments only.** Preview deployments read whichever database
their environment names, which in a single-database setup is the production
one — so migrating from a preview would apply a branch's schema change to
live data from a deploy nobody considers a release. Previews therefore run
against whatever schema production last migrated, and a preview whose code
needs a newer schema fails loudly. That's the intended outcome; promote the
branch to get its migration applied.

The script also **fails the build when `DATABASE_URL` is unset**, rather than
letting the deployment go live. Without it, settings fall back to a localhost
Postgres that does not exist inside a Function, and every request 500s with
`connection to server at "127.0.0.1", port 5432 failed` — a symptom that names
nothing about the actual cause.

To run migrations by hand anyway (or `createsuperuser`):

```bash
cd backend
vercel env pull .env.local                  # DATABASE_URL, DJANGO_SECRET_KEY, …
set -a && . ./.env.local && set +a          # manage.py does not read it by itself
DJANGO_SETTINGS_MODULE=config.settings.prod uv run python manage.py migrate
```

`DJANGO_SETTINGS_MODULE` is explicit there because `VERCEL` isn't set on your
machine — it's the one place you name the module by hand.

`collectstatic` needs no script: Vercel runs it because `STATIC_ROOT` is set.

### Celery

There is no long-lived worker process. `[[tool.vercel.subscribers]]` in
`backend/pyproject.toml` builds `worker.py` as a **private, queue-triggered
Function** that only Vercel Queues can invoke, and the `vercel://` broker
(set as `CELERY_BROKER_URL` automatically) publishes to Queues instead of
Redis. `.delay()` is unchanged at the call site, and no Redis is provisioned.

Topics are scoped to the project and deployment, not to a service, and a
queue consumer is never reachable from the internet — exposing a service with
a top-level rewrite does not expose its consumers.

The queue name is the whole binding between the two: `topics = ["celery"]`
must match `CELERY_TASK_DEFAULT_QUEUE`, or tasks publish to a topic nothing
subscribes to and vanish silently. `notes/tests/test_cron.py` asserts they
still agree.

Queues deliver **at least once** and redeliver anything that raises or times
out, so tasks must be idempotent — the purge is, since it deletes by a time
cutoff. Queues is a broker only, not a result backend.

`celery beat` also needs a process Vercel doesn't have, so the schedule moves
to a Vercel Cron Job. The `crons` entry in `vercel.json` hits
`/backend/api/cron/purge-archived-notes/` daily at 03:00 UTC — note the public
prefix — and that endpoint (`notes/cron.py`) enqueues the same task beat
would. It's a plain Django view rather than a DRF one because DRF's default
`JWTAuthentication` would try to decode Vercel's
`Authorization: Bearer $CRON_SECRET` header as a JWT and reject it first.

Two knobs on one policy: `NOTE_PURGE_INTERVAL_MINUTES` drives beat under
compose (hourly), the `crons` schedule drives Vercel (daily). The difference
is intentional — a trash countdown measured in days doesn't need sweeping
more often than daily, while locally you don't want to wait a day to watch
the purge fire. Daily also happens to be the most the Hobby plan allows; it
rejects the deployment outright otherwise, so raising it isn't just a config
change.

Either way, note what the cadence means for retention:
`NOTE_ARCHIVE_RETENTION_DAYS` is when a note becomes *eligible* for purging,
not when it vanishes. The gap is however long it is until the next run, so
with the default 1-day retention an archived note lives 1–2 days.

`docker compose up` is untouched by any of this — `worker` and `beat` still
run against Redis, from the same code.

### Account permissions

Several of the features this configuration depends on are gated, and a
deployment fails in confusing ways when one is off — a missing Python runtime
shows up as `The pattern "config/wsgi.py" defined in functions doesn't match
any Serverless Functions inside the api directory`, which is Vercel falling
back to zero-config because framework detection never ran. Confirm all of
these are enabled before debugging the config:

- **Services** — the whole layout above
- **The Python runtime** — required for Django to be detected at all
- **Vercel Queues** — required for the Celery subscriber

`vercel dev` runs both services together locally, with `vercel dev -L` for a
fully offline run.
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
