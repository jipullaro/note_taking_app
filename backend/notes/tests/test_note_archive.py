from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from notes.models import Category, Note

User = get_user_model()


class NoteArchiveTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="owner@example.com", password="s0me-strong-pass")
        self.client.force_authenticate(user=self.user)
        self.list_url = reverse("note-list")
        self.personal = Category.objects.get(owner=self.user, name="Personal")
        self.school = Category.objects.create(owner=self.user, name="School")

    def test_delete_archives_the_note_instead_of_destroying_it(self):
        note = Note.objects.create(owner=self.user, title="Bye", category=self.personal)

        response = self.client.delete(reverse("note-detail", args=[note.id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        note.refresh_from_db()
        self.assertIsNotNone(note.archived_at)

    def test_archiving_does_not_touch_updated_at(self):
        # Note.archive() saves with update_fields to keep updated_at's
        # auto_now from firing — archiving isn't an edit, so it must not
        # bump "Last Edited" or reshuffle the -updated_at ordering.
        note = Note.objects.create(owner=self.user, title="Bye", category=self.personal)
        before = note.updated_at

        self.client.delete(reverse("note-detail", args=[note.id]))

        note.refresh_from_db()
        self.assertEqual(note.updated_at, before)

    def test_archived_note_is_hidden_from_the_list(self):
        live = Note.objects.create(owner=self.user, title="Live", category=self.personal)
        archived = Note.objects.create(owner=self.user, title="Archived", category=self.personal)
        archived.archive()

        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([n["id"] for n in response.data], [live.id])

    def test_archived_note_404s_on_detail(self):
        note = Note.objects.create(owner=self.user, title="Archived", category=self.personal)
        note.archive()
        detail_url = reverse("note-detail", args=[note.id])

        # The editor autosaves, so an archived note staying reachable would
        # mean merely opening it starts PATCHing it back into existence.
        self.assertEqual(self.client.get(detail_url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            self.client.patch(detail_url, {"title": "Zombie"}).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(self.client.delete(detail_url).status_code, status.HTTP_404_NOT_FOUND)

    def test_archived_notes_are_excluded_from_counts(self):
        Note.objects.create(owner=self.user, title="Live", category=self.school)
        archived = Note.objects.create(owner=self.user, title="Archived", category=self.school)
        archived.archive()

        response = self.client.get(reverse("note-counts"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["all"], 1)
        self.assertEqual(response.data["archived"], 1)

        by_id = {c["id"]: c["count"] for c in response.data["categories"]}
        self.assertEqual(by_id[self.school.id], 1)

    def test_archived_true_returns_only_archived_newest_first(self):
        Note.objects.create(owner=self.user, title="Live", category=self.personal)
        first = Note.objects.create(owner=self.user, title="First out", category=self.personal)
        second = Note.objects.create(owner=self.user, title="Second out", category=self.personal)
        first.archive()
        second.archive()

        response = self.client.get(self.list_url, {"archived": "true"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([n["title"] for n in response.data], ["Second out", "First out"])

    def test_archived_false_matches_the_default(self):
        live = Note.objects.create(owner=self.user, title="Live", category=self.personal)
        archived = Note.objects.create(owner=self.user, title="Archived", category=self.personal)
        archived.archive()

        response = self.client.get(self.list_url, {"archived": "false"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([n["id"] for n in response.data], [live.id])

    def test_archived_filter_combines_with_the_category_filter(self):
        school_note = Note.objects.create(owner=self.user, title="School", category=self.school)
        personal_note = Note.objects.create(
            owner=self.user, title="Personal", category=self.personal
        )
        school_note.archive()
        personal_note.archive()

        response = self.client.get(self.list_url, {"archived": "true", "category": self.school.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([n["title"] for n in response.data], ["School"])

    def test_archived_filter_rejects_an_invalid_value(self):
        response = self.client.get(self.list_url, {"archived": "yes"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_restore_clears_the_flag_and_returns_the_note(self):
        note = Note.objects.create(owner=self.user, title="Back", category=self.personal)
        note.archive()

        response = self.client.post(reverse("note-restore", args=[note.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], note.id)
        self.assertIsNone(response.data["archived_at"])

        note.refresh_from_db()
        self.assertIsNone(note.archived_at)

    def test_restore_on_an_active_note_is_404(self):
        note = Note.objects.create(owner=self.user, title="Never left", category=self.personal)

        response = self.client.post(reverse("note-restore", args=[note.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_other_user_cannot_see_or_restore_an_archived_note(self):
        note = Note.objects.create(owner=self.user, title="Private", category=self.personal)
        note.archive()

        intruder = User.objects.create_user(
            email="intruder@example.com", password="s0me-strong-pass"
        )
        self.client.force_authenticate(user=intruder)

        response = self.client.get(self.list_url, {"archived": "true"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

        response = self.client.post(reverse("note-restore", args=[note.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        note.refresh_from_db()
        self.assertIsNotNone(note.archived_at)
