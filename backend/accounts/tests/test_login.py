from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class LoginTests(APITestCase):
    def setUp(self):
        self.url = reverse("token_obtain_pair")
        self.user = User.objects.create_user(email="login@example.com", password="correct-horse")

    def test_login_with_correct_credentials_returns_tokens(self):
        response = self.client.post(
            self.url, {"email": "login@example.com", "password": "correct-horse"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_with_wrong_password_is_rejected(self):
        response = self.client.post(
            self.url, {"email": "login@example.com", "password": "wrong-password"}
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "Invalid email or password.")

    def test_login_with_nonexistent_email_is_rejected(self):
        response = self.client.post(
            self.url, {"email": "nobody@example.com", "password": "whatever"}
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "Invalid email or password.")

    def test_wrong_password_and_nonexistent_email_return_identical_errors(self):
        """The two failure modes must be indistinguishable, otherwise this
        endpoint could be used to enumerate which emails have an account."""
        wrong_password = self.client.post(
            self.url, {"email": "login@example.com", "password": "wrong-password"}
        )
        no_such_user = self.client.post(
            self.url, {"email": "nobody@example.com", "password": "whatever"}
        )
        self.assertEqual(wrong_password.data, no_such_user.data)
