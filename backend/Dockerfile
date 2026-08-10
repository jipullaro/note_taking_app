FROM python:3.12-slim

# uv is the single dependency front-end for this project (see backend/Makefile
# and pyproject.toml); pull its static binary in rather than pip-installing it.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# docker-compose bind-mounts ./backend over /app, which would shadow a venv
# living inside the project. Keep it outside the mount, and put it on PATH so
# `python manage.py ...` resolves to it without a `uv run` prefix — that's
# what compose's `command:` relies on.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Dependency layer: only the manifests, so editing source doesn't reinstall
# the world. Dev deps are installed on purpose (no --no-dev) so pytest and
# ruff are runnable inside the image.
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-install-project

COPY . .

EXPOSE 8000
