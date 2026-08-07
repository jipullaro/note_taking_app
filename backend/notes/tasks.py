import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import Note

logger = logging.getLogger(__name__)

# Named explicitly so CELERY_BEAT_SCHEDULE can reference the same string the
# worker registers. Left implicit, the name is derived from the module path
# and a file move would silently stop beat's messages from matching anything
# — in a container nobody tails.
PURGE_TASK_NAME = "notes.purge_archived_notes"


@shared_task(name=PURGE_TASK_NAME)
def purge_archived_notes(retention_days=None):
    """Permanently delete notes archived longer than the retention window.

    Returns the number of notes deleted.

    `retention_days` defaults to None rather than to the setting itself: a
    default argument is evaluated at import time, which would bake the value
    into beat's in-memory schedule and make `override_settings` a no-op in
    tests. Read it from settings inside the body instead.
    """
    if retention_days is None:
        retention_days = settings.NOTE_ARCHIVE_RETENTION_DAYS

    cutoff = timezone.now() - timedelta(days=retention_days)
    deleted, _ = Note.objects.purgeable(before=cutoff).delete()

    logger.info(
        "Purged %s note(s) archived before %s (retention: %s day(s))",
        deleted,
        cutoff.isoformat(),
        retention_days,
    )
    return deleted
