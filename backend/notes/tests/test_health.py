"""The health probe for the backend service (config/health.py).

Project-level rather than notes-level, but it lives here for the same reason
test_url_prefix.py does: pytest's `testpaths` (see pyproject.toml) only
collects `accounts` and `notes`, so a test under config/ would never run.
"""

import json
from unittest.mock import patch

from django.db import OperationalError
from django.test import TestCase
from django.urls import reverse


class HealthEndpointTests(TestCase):
    # TestCase rather than SimpleTestCase: the healthy path runs a real query,
    # so the suite needs a database.

    def test_reports_ok_when_the_database_answers(self):
        response = self.client.get(reverse("health"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.content), {"status": "ok", "database": "ok"})

    def test_no_authentication_required(self):
        """An anonymous probe gets a real answer, not a 401.

        This is the whole reason config/health.py is a plain Django view. DRF's
        DEFAULT_PERMISSION_CLASSES is IsAuthenticated, so the obvious
        @api_view spelling would 401 every probe and report a healthy service
        as down. The request above is already unauthenticated — this names why
        that matters, so nobody "tidies" the view into DRF later.
        """
        response = self.client.get(reverse("health"))

        self.assertNotIn(response.status_code, (401, 403))

    def test_answer_is_never_cached(self):
        """A cached 200 outlives the health it reported."""
        response = self.client.get(reverse("health"))

        self.assertIn("no-store", response.headers["Cache-Control"])

    def test_reports_503_when_the_database_is_unreachable(self):
        with patch("config.health.connection.cursor", side_effect=OperationalError("boom")):
            response = self.client.get(reverse("health"))

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            json.loads(response.content),
            {"status": "unhealthy", "database": "unreachable"},
        )

    def test_failure_does_not_leak_the_database_error(self):
        """The driver's message can carry the connection string, and this
        endpoint is public and unauthenticated. It belongs in the log."""
        with (
            patch("config.health.connection.cursor", side_effect=OperationalError("boom")),
            self.assertLogs("config.health", level="ERROR"),
        ):
            response = self.client.get(reverse("health"))

        self.assertNotIn(b"boom", response.content)

    def test_rejects_methods_a_probe_would_never_send(self):
        """Only GET and HEAD get an answer.

        Asserted as "a rejection" rather than as 405, because which rejection
        depends on what's in front of the view. Against a real server a POST
        never reaches it: CsrfViewMiddleware answers 403 first, since there's
        no CSRF token on it. The test client runs with enforce_csrf_checks
        off, so here the view's own guard replies 405. Pinning either number
        would be pinning the test harness rather than the behaviour.
        """
        response = self.client.post(reverse("health"))

        self.assertIn(response.status_code, (403, 405))
