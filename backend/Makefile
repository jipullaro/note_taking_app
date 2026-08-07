# Local (non-Docker) backend dev loop via uv. Talks to the same Postgres
# that `docker compose up` starts — run `make -C .. up` (or `docker compose
# up -d postgres`) first so there's something on localhost:5432 to connect to.
#
# Credentials are read from ../.env, same as Docker Compose, so there's one
# source of truth. POSTGRES_HOST is forced to localhost here regardless of
# what .env says, since .env's "postgres" hostname only resolves inside the
# Docker network — from the host, Postgres is reachable via the port
# published in docker-compose.yml.
-include ../.env
export
POSTGRES_HOST := localhost

.PHONY: help install lock test migrate run shell

help:
	@echo "Targets (require Postgres reachable at localhost:5432 — see docker-compose.yml):"
	@echo "  install  - sync dependencies (incl. dev) via uv"
	@echo "  lock     - refresh uv.lock from pyproject.toml"
	@echo "  test     - run the test suite with pytest"
	@echo "  migrate  - apply Django migrations"
	@echo "  run      - run the Django dev server"
	@echo "  shell    - open the Django shell"

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
