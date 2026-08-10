# Docker-based workflow for the whole stack. For a faster backend-only
# loop without Docker, see backend/Makefile (uv-based, talks to the same
# Postgres via the port published below).

.PHONY: help build up down logs test migrate makemigrations backend-shell purge worker-logs frontend-lint frontend-build clean

help:
	@echo "Targets:"
	@echo "  build            - build the backend and frontend images"
	@echo "  up               - start the full stack (postgres, backend, frontend)"
	@echo "  down             - stop the stack"
	@echo "  logs             - follow logs for all services"
	@echo "  test             - run the backend test suite (pytest) in a one-off container"
	@echo "  migrate          - apply Django migrations in a one-off container"
	@echo "  makemigrations   - generate Django migrations in a one-off container"
	@echo "  backend-shell    - open a shell in a one-off backend container"
	@echo "  purge            - purge archived notes past the retention window (add ARGS='--dry-run')"
	@echo "  worker-logs      - follow the Celery worker and beat logs"
	@echo "  frontend-lint    - run eslint against the frontend"
	@echo "  frontend-build   - run a production Next.js build"
	@echo "  clean            - stop the stack and delete the Postgres volume"

build:
	docker compose build

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

test:
	docker compose run --rm backend pytest

migrate:
	docker compose run --rm backend python manage.py migrate

makemigrations:
	docker compose run --rm backend python manage.py makemigrations

backend-shell:
	docker compose run --rm backend python manage.py shell

# Runs the purge on demand, without a broker — same code path as the
# scheduled task. `make purge ARGS="--dry-run"` reports without deleting.
purge:
	docker compose run --rm backend python manage.py purge_archived_notes $(ARGS)

worker-logs:
	docker compose logs -f worker beat

frontend-lint:
	docker compose run --rm frontend npx eslint .

frontend-build:
	docker compose run --rm frontend npx next build

clean:
	docker compose down -v
