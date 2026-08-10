from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from notes.models import Category, Note

User = get_user_model()


class NoteCrudTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="owner@example.com", password="s0me-strong-pass")
        self.client.force_authenticate(user=self.user)
        self.list_url = reverse("note-list")
        # Every user gets a "Personal" category seeded by the post_save
        # signal (see notes/signals.py); grab it and add one more to work with.
        self.personal = Category.objects.get(owner=self.user, name="Personal")
        self.school = Category.objects.create(owner=self.user, name="School")

    def test_create_note(self):
        response = self.client.post(
            self.list_url,
            {"title": "Grocery List", "body": "Milk, eggs", "category_id": self.school.id},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        note = Note.objects.get()
        self.assertEqual(note.owner, self.user)
        self.assertEqual(note.category_id, self.school.id)
        self.assertEqual(response.data["category"], {"id": self.school.id, "name": "School"})

    def test_create_note_rejects_missing_category(self):
        response = self.client.post(self.list_url, {"title": "Bad", "body": "..."})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_note_rejects_another_users_category(self):
        other = User.objects.create_user(email="other@example.com", password="s0me-strong-pass")
        others_category = Category.objects.create(owner=other, name="Secret")

        response = self.client.post(
            self.list_url,
            {"title": "Bad", "body": "...", "category_id": others_category.id},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_notes_returns_only_own_notes(self):
        Note.objects.create(owner=self.user, title="Mine", category=self.personal)
        other = User.objects.create_user(email="other@example.com", password="s0me-strong-pass")
        other_category = Category.objects.get(owner=other, name="Personal")
        Note.objects.create(owner=other, title="Not mine", category=other_category)

        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "Mine")

    def test_retrieve_and_update_note(self):
        # DELETE is covered in test_note_archive.py, which is where the
        # interesting part now lives (it archives rather than destroys).
        note = Note.objects.create(owner=self.user, title="Original", category=self.personal)
        detail_url = reverse("note-detail", args=[note.id])

        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.patch(detail_url, {"title": "Updated"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        note.refresh_from_db()
        self.assertEqual(note.title, "Updated")

        response = self.client.patch(detail_url, {"category_id": self.school.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        note.refresh_from_db()
        self.assertEqual(note.category_id, self.school.id)

    def test_category_filter(self):
        Note.objects.create(owner=self.user, title="A", category=self.school)
        Note.objects.create(owner=self.user, title="B", category=self.personal)

        response = self.client.get(self.list_url, {"category": self.school.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "A")

    def test_category_filter_rejects_invalid_id(self):
        response = self.client.get(self.list_url, {"category": "bogus"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_category_filter_rejects_another_users_category_id(self):
        other = User.objects.create_user(email="other@example.com", password="s0me-strong-pass")
        others_category = Category.objects.get(owner=other, name="Personal")

        response = self.client.get(self.list_url, {"category": others_category.id})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_counts_endpoint(self):
        Note.objects.create(owner=self.user, title="A", category=self.school)
        Note.objects.create(owner=self.user, title="B", category=self.school)
        Note.objects.create(owner=self.user, title="C", category=self.personal)

        response = self.client.get(reverse("note-counts"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["all"], 3)

        by_id = {c["id"]: c["count"] for c in response.data["categories"]}
        self.assertEqual(by_id[self.school.id], 2)
        self.assertEqual(by_id[self.personal.id], 1)
