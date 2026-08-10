"""Re-export the Celery app so it's built whenever Django is.

`@shared_task` binds to whichever app is current, so the app has to exist by
the time any task module is imported. This is import-only — no broker
connection is opened — so it costs the test suite and the dev server
nothing.
"""

from .celery import app as celery_app

__all__ = ("celery_app",)
