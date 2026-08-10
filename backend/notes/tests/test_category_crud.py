from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from notes.models import Category, Note

User = get_user_model()


class CategorySignalTests(APITestCase):
    def test_new_user_is_seeded_with_a_personal_category(self):
        user = User.objects.create_user(email="fresh@example.com", password="s0me-strong-pass")
        self.assertTrue(Category.objects.filter(owner=user, name="Personal").exists())


class CategoryCrudTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="owner@example.com", password="s0me-strong-pass")
        self.client.force_authenticate(user=self.user)
        self.list_url = reverse("category-list")
        # Seeded by the post_save signal on user creation.
        self.personal = Category.objects.get(owner=self.user, name="Personal")

    def test_list_returns_only_own_categories(self):
        other = User.objects.create_user(email="other@example.com", password="s0me-strong-pass")
        Category.objects.create(owner=other, name="Work")

        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([c["name"] for c in response.data], ["Personal"])

    def test_create_category(self):
        response = self.client.post(self.list_url, {"name": "Random Thoughts"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Category.objects.filter(owner=self.user, name="Random Thoughts").exists())

    def test_create_category_rejects_blank_name(self):
        response = self.client.post(self.list_url, {"name": "   "})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_category_rejects_duplicate_name_case_insensitively(self):
        response = self.client.post(self.list_url, {"name": "personal"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_two_different_users_can_have_a_same_named_category(self):
        # The signal seeds "Personal" for every user, so creating a second
        # user is enough to prove the uniqueness constraint is scoped per
        # owner rather than global.
        User.objects.create_user(email="other@example.com", password="s0me-strong-pass")
        self.assertEqual(Category.objects.filter(name="Personal").count(), 2)

    def test_rename_category(self):
        detail_url = reverse("category-detail", args=[self.personal.id])
        response = self.client.patch(detail_url, {"name": "Me Time"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.personal.refresh_from_db()
        self.assertEqual(self.personal.name, "Me Time")

    def test_delete_empty_category(self):
        category = Category.objects.create(owner=self.user, name="Unused")
        detail_url = reverse("category-detail", args=[category.id])
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Category.objects.filter(id=category.id).exists())

    def test_delete_category_with_notes_is_blocked(self):
        Note.objects.create(owner=self.user, title="Keep me", category=self.personal)
        detail_url = reverse("category-detail", args=[self.personal.id])

        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Category.objects.filter(id=self.personal.id).exists())

    def test_delete_category_with_only_archived_notes_is_allowed(self):
        # Archived notes don't block the delete — they're already on their
        # way out, and they go down with the category via CASCADE. See the
        # comment in CategoryViewSet.destroy.
        note = Note.objects.create(owner=self.user, title="Trashed", category=self.personal)
        note.archive()
        detail_url = reverse("category-detail", args=[self.personal.id])

        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Category.objects.filter(id=self.personal.id).exists())
        self.assertFalse(Note.objects.filter(id=note.id).exists())

    def test_unauthenticated_requests_are_rejected(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_other_user_cannot_access_this_users_category(self):
        other = User.objects.create_user(email="other@example.com", password="s0me-strong-pass")
        self.client.force_authenticate(user=other)

        detail_url = reverse("category-detail", args=[self.personal.id])
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
