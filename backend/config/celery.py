"""Celery entry point.

Importing this module is side-effect free beyond building the app object —
it opens no broker connection — so `config/__init__.py` can re-export it
unconditionally and the test suite runs without Redis.
"""

import os

from celery import Celery

# Same default as manage.py, so a worker started without an explicit
# DJANGO_SETTINGS_MODULE lands on the same settings the app does.
os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings.prod" if os.environ.get("VERCEL") else "config.settings.dev",
)

app = Celery("config")
# Celery settings live in Django settings under a CELERY_ prefix, so there's
# one place to configure the project.
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
