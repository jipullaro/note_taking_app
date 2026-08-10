from datetime import timedelta
from io import StringIO

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from notes.models import Category, Note
from notes.tasks import purge_archived_notes

User = get_user_model()


def archived_ago(note, **delta):
    """Backdate a note's archive timestamp.

    Written straight to the DB rather than through `archive()` so the helper
    can place a note anywhere relative to the retention window without
    waiting for real time to pass.
    """
    Note.objects.filter(pk=note.pk).update(archived_at=timezone.now() - timedelta(**delta))
    note.refresh_from_db()
    return note


class PurgeArchivedNotesTests(TestCase):
    """The task is called directly, not through Celery.

    No broker and no CELERY_TASK_ALWAYS_EAGER: what's under test is the
    purge logic, and routing it through Celery would only add a dependency
    on the transport being configured a particular way in tests.
    """

    def setUp(self):
        self.user = User.objects.create_user(email="owner@example.com", password="s0me-strong-pass")
        self.category = Category.objects.get(owner=self.user, name="Personal")

    def make_note(self, title="Note"):
        return Note.objects.create(owner=self.user, title=title, category=self.category)

    def test_purges_notes_archived_past_the_window(self):
        stale = archived_ago(self.make_note("Stale"), days=2)

        deleted = purge_archived_notes()

        self.assertEqual(deleted, 1)
        self.assertFalse(Note.objects.filter(pk=stale.pk).exists())

    def test_keeps_notes_still_inside_the_window(self):
        fresh = archived_ago(self.make_note("Fresh"), hours=2)

        self.assertEqual(purge_archived_notes(), 0)
        self.assertTrue(Note.objects.filter(pk=fresh.pk).exists())

    @override_settings(NOTE_ARCHIVE_RETENTION_DAYS=7)
    def test_respects_the_retention_setting(self):
        # This is the test that fails if retention is read as a default
        # argument: a default is evaluated at import time, so override_settings
        # would have no effect and the 3-day-old note would be purged.
        recent = archived_ago(self.make_note("Three days old"), days=3)
        ancient = archived_ago(self.make_note("Ten days old"), days=10)

        deleted = purge_archived_notes()

        self.assertEqual(deleted, 1)
        self.assertTrue(Note.objects.filter(pk=recent.pk).exists())
        self.assertFalse(Note.objects.filter(pk=ancient.pk).exists())

    def test_explicit_argument_wins_over_the_setting(self):
        note = archived_ago(self.make_note("Two hours old"), hours=2)

        deleted = purge_archived_notes(retention_days=0)

        self.assertEqual(deleted, 1)
        self.assertFalse(Note.objects.filter(pk=note.pk).exists())

    def test_never_touches_active_notes(self):
        live = self.make_note("Live")
        archived_ago(self.make_note("Stale"), days=5)

        self.assertEqual(purge_archived_notes(), 1)
        self.assertTrue(Note.objects.filter(pk=live.pk).exists())

    def test_is_idempotent(self):
        archived_ago(self.make_note("Stale"), days=2)

        self.assertEqual(purge_archived_notes(), 1)
        self.assertEqual(purge_archived_notes(), 0)

    def test_spans_all_users(self):
        # The purge is a system job, not a request — it isn't scoped to an
        # owner the way every view in this app is.
        other = User.objects.create_user(email="other@example.com", password="s0me-strong-pass")
        other_category = Category.objects.get(owner=other, name="Personal")
        archived_ago(self.make_note("Mine"), days=2)
        archived_ago(
            Note.objects.create(owner=other, title="Theirs", category=other_category), days=2
        )

        self.assertEqual(purge_archived_notes(), 2)
        self.assertEqual(Note.objects.count(), 0)


class PurgeCommandTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="owner@example.com", password="s0me-strong-pass")
        self.category = Category.objects.get(owner=self.user, name="Personal")
        self.note = archived_ago(
            Note.objects.create(owner=self.user, title="Stale", category=self.category), days=2
        )

    def test_command_purges(self):
        out = StringIO()
        call_command("purge_archived_notes", stdout=out)

        self.assertIn("Purged 1 note(s).", out.getvalue())
        self.assertFalse(Note.objects.filter(pk=self.note.pk).exists())

    def test_command_dry_run_reports_without_deleting(self):
        out = StringIO()
        call_command("purge_archived_notes", "--dry-run", stdout=out)

        self.assertIn("Would purge 1 note(s)", out.getvalue())
        self.assertTrue(Note.objects.filter(pk=self.note.pk).exists())

    def test_command_days_option_overrides_the_setting(self):
        out = StringIO()
        call_command("purge_archived_notes", "--days", "7", stdout=out)

        self.assertIn("Purged 0 note(s).", out.getvalue())
        self.assertTrue(Note.objects.filter(pk=self.note.pk).exists())


class BeatScheduleTests(TestCase):
    def test_schedule_points_at_the_registered_task(self):
        # settings can't import notes.tasks (app registry isn't ready), so
        # the schedule names the task as a literal string. This is the only
        # thing keeping the two in step — and a mismatch fails silently, in
        # a container nobody tails, so it's worth a cheap assertion.
        entry = settings.CELERY_BEAT_SCHEDULE["purge-archived-notes"]
        self.assertEqual(entry["task"], purge_archived_notes.name)
