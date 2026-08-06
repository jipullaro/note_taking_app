from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class RegisterTests(APITestCase):
    def setUp(self):
        self.url = reverse("register")

    def test_register_creates_user_with_hashed_password(self):
        response = self.client.post(
            self.url, {"email": "new@example.com", "password": "s0me-strong-pass"}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="new@example.com")
        self.assertNotEqual(user.password, "s0me-strong-pass")
        self.assertTrue(user.check_password("s0me-strong-pass"))
        self.assertNotIn("password", response.data)

    def test_register_rejects_duplicate_email(self):
        User.objects.create_user(email="dup@example.com", password="s0me-strong-pass")
        response = self.client.post(
            self.url, {"email": "dup@example.com", "password": "another-strong-pass"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Must not confirm an account exists via DRF's default "user with
        # this email already exists" wording — that's an enumeration vector.
        self.assertNotIn("already exists", str(response.data))

    def test_register_rejects_weak_password(self):
        response = self.client.post(self.url, {"email": "weak@example.com", "password": "123"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_rejects_missing_fields(self):
        response = self.client.post(self.url, {"email": "onlyemail@example.com"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
