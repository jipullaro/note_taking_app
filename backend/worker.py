"""Celery worker entrypoint for Vercel Queues.

`[[tool.vercel.subscribers]]` in pyproject.toml points at `worker:app`, and
Vercel builds it as a private, queue-triggered Function — nothing but Vercel
Queues can invoke it. There is no long-lived `celery worker` process on
Vercel; docker-compose still runs one against the same code (see the
`worker` service), which is why this module only wires things up and defines
nothing of its own.

Django has to be set up by hand here. Under WSGI that happens inside
`get_wsgi_application()`; a queue-triggered function never goes through it,
so without `django.setup()` the first task to touch a model raises
AppRegistryNotReady.
"""

import os

import django

# See the comment in manage.py.
os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings.prod" if os.environ.get("VERCEL") else "config.settings.dev",
)

django.setup()

# Both imports have to follow django.setup(), hence their position here
# rather than at the top of the file.
#
# notes.tasks is imported for its side effect: @shared_task registers on the
# current app at import time, and autodiscover_tasks() is lazy — it only runs
# when something first asks the app to finalize. Importing the module
# explicitly means the task is registered before the first message arrives
# rather than depending on that timing, and it makes the queue -> task
# wiring greppable.
import notes.tasks  # noqa: E402,F401
from config.celery import app  # noqa: E402

__all__ = ["app"]
