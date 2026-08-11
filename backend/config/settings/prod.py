"""Production settings — what runs on Vercel.

Every entrypoint (manage.py, wsgi.py, asgi.py, celery.py, worker.py)
defaults DJANGO_SETTINGS_MODULE to this module whenever the VERCEL
environment variable is present, so *anything* on Vercel — production,
preview and `vercel dev` alike — lands here without the project needing to
set a variable. There is no separate preview configuration: a preview
deployment is a production deployment pointed at whatever database its env
vars name.

The dev module next door sets DEBUG = True and ALLOWED_HOSTS = ["*"], so
landing on it on Vercel would be a security incident rather than a
misconfiguration; it refuses to load there for that reason.
"""

import os

from .base import *  # noqa: F401,F403

DEBUG = False

# Django shares the deployment's domain with the Next.js service, so it is
# published under /backend/* (see `rewrites` in the repo-root vercel.json).
# The default lives here rather than in the Vercel project's environment
# variables for the same reason the settings module does: a prefix that has
# to be remembered is a prefix that will be forgotten, and the failure is a
# 404 on every API call rather than anything that names the cause.
URL_PREFIX = os.environ.get("DJANGO_URL_PREFIX", "backend").strip("/")

if not os.environ.get("DJANGO_SECRET_KEY"):
    raise RuntimeError(
        "DJANGO_SECRET_KEY must be set in production. base.py falls back to a "
        "known dev key, which would make every session cookie and password "
        "reset token in this deployment forgeable."
    )


def _csv(name):
    """Comma-separated env var -> list, empty entries dropped."""
    return [item.strip() for item in os.environ.get(name, "").split(",") if item.strip()]


# Vercel gives each deployment a generated hostname and, in production, the
# project's stable one. Both are read at runtime so ALLOWED_HOSTS doesn't
# have to be re-set for every preview deployment; DJANGO_ALLOWED_HOSTS is
# for custom domains, which Vercel does not expose as an env var.
_vercel_hosts = [
    host
    for host in (
        os.environ.get("VERCEL_URL"),
        os.environ.get("VERCEL_BRANCH_URL"),
        os.environ.get("VERCEL_PROJECT_PRODUCTION_URL"),
    )
    if host
]

# `vercel dev` runs these same settings over plain HTTP on localhost, where
# none of the above are set and forcing HTTPS would redirect in a loop.
_local = os.environ.get("VERCEL_ENV") == "development"
if _local:
    _vercel_hosts += ["localhost", "127.0.0.1"]

ALLOWED_HOSTS = sorted({*_vercel_hosts, *_csv("DJANGO_ALLOWED_HOSTS")})

# The frontend talks to this API from its Next.js server (see the
# /api/proxy/* route handlers), so browser CORS usually isn't in play at
# all — leave this unset unless something calls the API from a browser
# directly.
CORS_ALLOWED_ORIGINS = _csv("CORS_ALLOWED_ORIGINS")

# Needed for the Django admin's login form: it posts over HTTPS, so Django
# checks Origin against this list. Every host Vercel serves is HTTPS-only,
# so each accepted host is trusted at its https:// origin.
_scheme = "http" if _local else "https"
CSRF_TRUSTED_ORIGINS = [f"{_scheme}://{host}" for host in ALLOWED_HOSTS] + CORS_ALLOWED_ORIGINS

# Vercel terminates TLS at the edge and forwards over HTTP, so without this
# Django believes every request is insecure — which would make the redirect
# below an infinite loop and the cookie flags below no-ops.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = not _local
SESSION_COOKIE_SECURE = not _local
CSRF_COOKIE_SECURE = not _local

# Logging goes to stdout, which is where Vercel's runtime logs read from.
# Without an explicit config Django's default swallows non-error logs from
# app code, so the purge task's "Purged N note(s)" line would never appear.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"simple": {"format": "%(levelname)s %(name)s %(message)s"}},
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "simple"},
    },
    "root": {"handlers": ["console"], "level": os.environ.get("DJANGO_LOG_LEVEL", "INFO")},
}
