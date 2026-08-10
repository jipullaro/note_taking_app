from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from notes.models import Category, Note

User = get_user_model()


class NoteOwnershipTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="s0me-strong-pass"
        )
        self.intruder = User.objects.create_user(
            email="intruder@example.com", password="s0me-strong-pass"
        )
        owner_category = Category.objects.get(owner=self.owner, name="Personal")
        self.note = Note.objects.create(owner=self.owner, title="Private", category=owner_category)
        self.detail_url = reverse("note-detail", args=[self.note.id])

    def test_unauthenticated_requests_are_rejected(self):
        response = self.client.get(reverse("note-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_other_user_cannot_retrieve_note(self):
        self.client.force_authenticate(user=self.intruder)
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_other_user_cannot_update_note(self):
        self.client.force_authenticate(user=self.intruder)
        response = self.client.patch(self.detail_url, {"title": "Hacked"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.note.refresh_from_db()
        self.assertEqual(self.note.title, "Private")

    def test_other_user_cannot_delete_note(self):
        self.client.force_authenticate(user=self.intruder)
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Note.objects.filter(id=self.note.id).exists())
        # "Still exists" stopped being enough evidence once DELETE archives
        # instead of destroying — an archived note still exists. Without this
        # assertion the test would pass with IsOwner removed entirely.
        self.note.refresh_from_db()
        self.assertIsNone(self.note.archived_at)

    def test_other_user_does_not_see_note_in_list(self):
        self.client.force_authenticate(user=self.intruder)
        response = self.client.get(reverse("note-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)
