from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from notes.models import Note

User = get_user_model()


class NoteCrudTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="owner@example.com", password="s0me-strong-pass")
        self.client.force_authenticate(user=self.user)
        self.list_url = reverse("note-list")

    def test_create_note(self):
        response = self.client.post(
            self.list_url,
            {"title": "Grocery List", "body": "Milk, eggs", "category": "school"},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        note = Note.objects.get()
        self.assertEqual(note.owner, self.user)
        self.assertEqual(note.category, "school")

    def test_create_note_rejects_invalid_category(self):
        response = self.client.post(
            self.list_url,
            {"title": "Bad", "body": "...", "category": "not-a-real-category"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_notes_returns_only_own_notes(self):
        Note.objects.create(owner=self.user, title="Mine", category="drama")
        other = User.objects.create_user(email="other@example.com", password="s0me-strong-pass")
        Note.objects.create(owner=other, title="Not mine", category="drama")

        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "Mine")

    def test_retrieve_update_delete_note(self):
        note = Note.objects.create(owner=self.user, title="Original", category="personal")
        detail_url = reverse("note-detail", args=[note.id])

        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.patch(detail_url, {"title": "Updated"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        note.refresh_from_db()
        self.assertEqual(note.title, "Updated")

        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Note.objects.filter(id=note.id).exists())

    def test_category_filter(self):
        Note.objects.create(owner=self.user, title="A", category="school")
        Note.objects.create(owner=self.user, title="B", category="drama")

        response = self.client.get(self.list_url, {"category": "school"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "A")

    def test_category_filter_rejects_invalid_key(self):
        response = self.client.get(self.list_url, {"category": "bogus"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_counts_endpoint(self):
        Note.objects.create(owner=self.user, title="A", category="school")
        Note.objects.create(owner=self.user, title="B", category="school")
        Note.objects.create(owner=self.user, title="C", category="drama")

        response = self.client.get(reverse("note-counts"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["school"], 2)
        self.assertEqual(response.data["drama"], 1)
        self.assertEqual(response.data["personal"], 0)
        self.assertEqual(response.data["random_thoughts"], 0)
        self.assertEqual(response.data["all"], 3)
