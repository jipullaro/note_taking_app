"""Base settings shared by all environments."""

import os
import urllib.parse
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "insecure-dev-key-change-me")

DEBUG = False

ALLOWED_HOSTS: list[str] = []

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "accounts",
    "notes",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Managed Postgres providers (and Vercel's marketplace integrations) hand
# out a single DATABASE_URL rather than the five POSTGRES_* variables
# docker-compose sets, so both spellings are accepted. DATABASE_URL wins when
# present — it's the one a hosting provider injects, and it should not be
# possible for a stale POSTGRES_HOST to quietly point production somewhere
# else.
#
# CONN_MAX_AGE defaults to 0 (close the connection at the end of every
# request) because this runs on serverless functions in production: each
# concurrent instance holds its own connection, and persistent ones exhaust
# a managed Postgres's connection limit long before traffic does. Point
# DATABASE_URL at the provider's *pooled* endpoint and pooling stays the
# pooler's job, where it belongs.
_conn_max_age = int(os.environ.get("DB_CONN_MAX_AGE", "0"))


def _database_from_url(url):
    parsed = urllib.parse.urlparse(url)
    query = urllib.parse.parse_qs(parsed.query)
    options = {}
    # Neon, Supabase et al. append ?sslmode=require; dropping it silently
    # downgrades the connection to plaintext.
    if "sslmode" in query:
        options["sslmode"] = query["sslmode"][0]
    # urlparse does not percent-decode these, so a password with an @ or /
    # in it arrives still escaped.
    unquote = urllib.parse.unquote
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": unquote(parsed.path.lstrip("/")),
        "USER": unquote(parsed.username or ""),
        "PASSWORD": unquote(parsed.password or ""),
        "HOST": parsed.hostname or "",
        "PORT": str(parsed.port or ""),
        "OPTIONS": options,
        "CONN_MAX_AGE": _conn_max_age,
    }


if os.environ.get("DATABASE_URL"):
    DATABASES = {"default": _database_from_url(os.environ["DATABASE_URL"])}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("POSTGRES_DB", "notes"),
            "USER": os.environ.get("POSTGRES_USER", "notes"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "notes"),
            "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
            "CONN_MAX_AGE": _conn_max_age,
        }
    }

AUTH_USER_MODEL = "accounts.CustomUser"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
# Vercel runs `collectstatic` during the build *because* STATIC_ROOT is set,
# then serves the result from its CDN at STATIC_URL. Without it the build
# skips collection and the admin loads unstyled. Gitignored — it's build
# output, not source.
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": None,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.environ.get("SIMPLE_JWT_ACCESS_MINUTES", "30"))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.environ.get("SIMPLE_JWT_REFRESH_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

CORS_ALLOW_CREDENTIALS = True

# --- Archive retention / Celery ---

# How long an archived note sticks around before it's purged for good.
NOTE_ARCHIVE_RETENTION_DAYS = int(os.environ.get("NOTE_ARCHIVE_RETENTION_DAYS", "1"))

# Redis locally (docker-compose). On Vercel this is set to "vercel://" for
# you, which routes tasks through Vercel Queues instead of a broker you run
# — see "Deploying to Vercel" in the README.
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")

# Celery's own default is already "celery"; it's pinned explicitly because
# on Vercel the queue name is half of a contract. `topics` in
# pyproject.toml's [[tool.vercel.subscribers]] has to name this exact queue,
# or tasks are published to a topic nothing subscribes to and disappear
# without an error. test_cron.py asserts the two still agree.
CELERY_TASK_DEFAULT_QUEUE = os.environ.get("CELERY_TASK_DEFAULT_QUEUE", "celery")

# The purge schedule is static and lives in version control rather than in
# django-celery-beat. The DB-backed scheduler buys runtime-editable
# schedules — at the cost of an extra installed app, its migrations, and an
# admin surface — and nothing here needs to change the retention policy
# without a deploy.
#
# The task is a literal string rather than an import: settings can't import
# an app module without touching models before the app registry is ready.
# notes/tasks.py pins the same string via an explicit `name=`, and
# test_purge.py asserts the two still agree — that's the drift guard.
#
# This schedule only runs where a `celery beat` process does, i.e. under
# docker-compose. Vercel has no long-lived process to host beat, so there
# the same task is enqueued by a Vercel Cron Job hitting
# /api/cron/purge-archived-notes/ (see notes/cron.py). Both paths end in the
# same task, so the interval below and the `crons` entry in
# backend/vercel.json are two knobs on the same policy.
#
# They are deliberately not set to the same cadence. Daily is enough for a
# trash countdown measured in days, so that's what Vercel runs; the hourly
# interval below is a development convenience, where waiting a day to watch
# the purge fire is useless. (Daily is also the most the Hobby plan allows
# — it rejects the deployment outright otherwise — so raising it is not
# just a config change.)
#
# Either way, note what the cadence means for the retention window:
# NOTE_ARCHIVE_RETENTION_DAYS is when a note *becomes* purgeable, not when
# it disappears. The gap is however long it is until the next run.
CELERY_BEAT_SCHEDULE = {
    "purge-archived-notes": {
        "task": "notes.purge_archived_notes",
        "schedule": timedelta(minutes=int(os.environ.get("NOTE_PURGE_INTERVAL_MINUTES", "60"))),
    },
}
