from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from notes.models import Note
from notes.tasks import purge_archived_notes


class Command(BaseCommand):
    help = (
        "Permanently delete notes archived longer than the retention window. "
        "Runs the same code as the scheduled Celery task, without needing a broker."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=None,
            help="Retention window in days (defaults to NOTE_ARCHIVE_RETENTION_DAYS).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be purged without deleting anything.",
        )

    def handle(self, *args, **options):
        days = options["days"]
        if days is None:
            days = settings.NOTE_ARCHIVE_RETENTION_DAYS

        if options["dry_run"]:
            cutoff = timezone.now() - timedelta(days=days)
            count = Note.objects.purgeable(before=cutoff).count()
            self.stdout.write(f"Would purge {count} note(s) archived before {cutoff.isoformat()}.")
            return

        # Calls the task's function body directly rather than .delay(): the
        # command's whole point is running the purge with no broker up, and
        # going through the same function keeps one implementation.
        deleted = purge_archived_notes(retention_days=days)
        self.stdout.write(self.style.SUCCESS(f"Purged {deleted} note(s)."))
