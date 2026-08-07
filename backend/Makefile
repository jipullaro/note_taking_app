# Local (non-Docker) backend dev loop via uv. Talks to the same Postgres
# that `docker compose up` starts — run `make -C .. up` (or `docker compose
# up -d postgres`) first so there's something on localhost:5432 to connect to.
#
# Credentials are read from ../.env, same as Docker Compose, so there's one
# source of truth. POSTGRES_HOST and CELERY_BROKER_URL are forced to localhost
# here regardless of what .env says, since .env's "postgres" and "redis"
# hostnames only resolve inside the Docker network — from the host, both are
# reachable via the ports published in docker-compose.yml.
-include ../.env
export
POSTGRES_HOST := localhost
CELERY_BROKER_URL := redis://localhost:6379/0

.PHONY: help install lock test migrate run shell purge

help:
	@echo "Targets (require Postgres reachable at localhost:5432 — see docker-compose.yml):"
	@echo "  install  - sync dependencies (incl. dev) via uv"
	@echo "  lock     - refresh uv.lock from pyproject.toml"
	@echo "  test     - run the test suite with pytest"
	@echo "  migrate  - apply Django migrations"
	@echo "  run      - run the Django dev server"
	@echo "  shell    - open the Django shell"
	@echo "  purge    - purge archived notes past the retention window (ARGS='--dry-run')"

install:
	uv sync

lock:
	uv lock

test:
	uv run pytest

migrate:
	uv run python manage.py migrate

run:
	uv run python manage.py runserver

shell:
	uv run python manage.py shell

# Same code path as the scheduled task, no broker needed.
purge:
	uv run python manage.py purge_archived_notes $(ARGS)
