"""Development / docker-compose settings."""

import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403

# Anything running on Vercel uses config.settings.prod — every entrypoint
# defaults to it when VERCEL is set. Reaching this module there means
# DJANGO_SETTINGS_MODULE was set to it explicitly, which would put
# DEBUG = True and ALLOWED_HOSTS = ["*"] on the internet with nothing
# looking wrong. Fail loudly instead.
if os.environ.get("VERCEL"):
    raise ImproperlyConfigured(
        "config.settings.dev must not run on Vercel — use config.settings.prod. "
        "Unset DJANGO_SETTINGS_MODULE in the project's environment variables "
        "to get it by default."
    )

DEBUG = True

ALLOWED_HOSTS = ["*"]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
