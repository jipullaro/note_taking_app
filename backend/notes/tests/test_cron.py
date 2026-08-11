import json
import os
import tomllib
from pathlib import Path
from unittest.mock import patch

from django.conf import settings
from django.test import TestCase
from django.urls import reverse

CRON_SECRET = "test-cron-secret"


def _vercel_json():
    """The single vercel.json, which lives one level up from BASE_DIR.

    Both services are configured in one file at the repo root — `root` in a
    service is relative to it — so this is deliberately outside the Django
    project.
    """
    return Path(settings.BASE_DIR).parent / "vercel.json"


def _backend_public_prefix(config):
    """The public path prefix the backend service is mounted at.

    Read from the rewrite that routes traffic into the service rather than
    hardcoded, because Django is mounted under this exact prefix in its own
    URLconf (see URL_PREFIX in config/settings/base.py). Vercel delivers the
    path unchanged, so the rewrite's prefix and Django's have to be the same
    string or every request 404s.
    """
    (source,) = [
        rewrite["source"]
        for rewrite in config["rewrites"]
        if rewrite["destination"] == {"service": "backend"} and rewrite["source"] != "/static/(.*)"
    ]
    return source[: source.index("/(.*)")]  # "/backend/(.*)" -> "/backend"


def with_secret(value=CRON_SECRET):
    """Patch CRON_SECRET into the environment for the duration of a block.

    The view reads it from os.environ at call time (not import time), so
    this is what configures it — `override_settings` has nothing to do with
    it, since it is deliberately not a Django setting: it's Vercel's, and
    Vercel is the only thing that sets it.
    """
    env = dict(os.environ)
    env.pop("CRON_SECRET", None)
    if value is not None:
        env["CRON_SECRET"] = value
    return patch.dict(os.environ, env, clear=True)


class PurgeCronEndpointTests(TestCase):
    """The Vercel Cron trigger for the archive purge.

    `.delay()` is mocked throughout: what's under test is the endpoint's
    authentication and that it enqueues the right task, not Celery's
    transport. The purge itself is covered in test_purge.py.
    """

    def setUp(self):
        self.url = reverse("cron-purge-archived-notes")

    def get(self, bearer=CRON_SECRET):
        headers = {"Authorization": f"Bearer {bearer}"} if bearer is not None else {}
        return self.client.get(self.url, headers=headers)

    @patch("notes.cron.purge_archived_notes.delay")
    def test_enqueues_with_a_valid_secret(self, delay):
        # No session and no JWT anywhere in this request: the endpoint is
        # authenticated by the shared secret alone. That's why it's a plain
        # Django view — DRF's default JWTAuthentication would try to decode
        # the secret as a token and 401 before any check of ours ran.
        delay.return_value.id = "task-123"

        with with_secret():
            response = self.get()

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json(), {"taskId": "task-123"})
        delay.assert_called_once_with()

    @patch("notes.cron.purge_archived_notes.delay")
    def test_rejects_a_wrong_secret(self, delay):
        with with_secret():
            response = self.get(bearer="not-the-secret")

        self.assertEqual(response.status_code, 401)
        delay.assert_not_called()

    @patch("notes.cron.purge_archived_notes.delay")
    def test_rejects_a_missing_header(self, delay):
        with with_secret():
            response = self.get(bearer=None)

        self.assertEqual(response.status_code, 401)
        delay.assert_not_called()

    @patch("notes.cron.purge_archived_notes.delay")
    def test_fails_closed_when_no_secret_is_configured(self, delay):
        # The important one: an unset CRON_SECRET must not degrade into an
        # open endpoint, because the task it triggers deletes rows for good.
        with with_secret(None):
            response = self.get()

        self.assertEqual(response.status_code, 503)
        delay.assert_not_called()

    @patch("notes.cron.purge_archived_notes.delay")
    def test_non_ascii_header_is_rejected_not_crashed(self, delay):
        # hmac.compare_digest raises TypeError on a str containing non-ASCII,
        # and the header is attacker-controlled — so this has to be a 401,
        # not a 500.
        with with_secret():
            response = self.get(bearer="pässwörd")

        self.assertEqual(response.status_code, 401)
        delay.assert_not_called()

    @patch("notes.cron.purge_archived_notes.delay")
    def test_rejects_other_methods(self, delay):
        with with_secret():
            response = self.client.delete(
                self.url, headers={"Authorization": f"Bearer {CRON_SECRET}"}
            )

        self.assertEqual(response.status_code, 405)
        delay.assert_not_called()


class VercelQueueContractTests(TestCase):
    """The wiring that only breaks in a deployment, asserted here instead.

    On Vercel the queue name is the whole binding between the web Function
    that calls `.delay()` and the private worker Function that runs the
    task. A mismatch publishes tasks to a topic nothing subscribes to: no
    error, no worker invocation, no purge — and nothing in a test suite that
    only exercises the task directly would notice.
    """

    def test_default_queue_matches_the_vercel_subscriber_topic(self):
        pyproject = Path(settings.BASE_DIR) / "pyproject.toml"
        with pyproject.open("rb") as fh:
            subscribers = tomllib.load(fh)["tool"]["vercel"]["subscribers"]

        topics = {topic for subscriber in subscribers for topic in subscriber["topics"]}
        self.assertIn(settings.CELERY_TASK_DEFAULT_QUEUE, topics)

    def test_cron_path_matches_the_route_through_the_public_prefix(self):
        """The cron URL is public, so it carries the service's path prefix.

        Vercel hands the service the original path, prefix included, and
        Django is mounted under that same prefix — so the scheduled path is
        the prefix plus what `reverse()` resolves to here (the suite runs
        unprefixed). The prefix is read from vercel.json rather than
        hardcoded, so renaming the mount point has to move both ends.

        Vercel's scheduler gets no feedback if the path 404s.
        """
        config = json.loads(_vercel_json().read_text())
        crons = {cron["path"] for cron in config["crons"]}

        self.assertIn(_backend_public_prefix(config) + reverse("cron-purge-archived-notes"), crons)

    def test_prod_mounts_django_under_the_prefix_it_is_routed_at(self):
        """The rewrite prefix and Django's URL prefix are one fact, twice.

        vercel.json routes `/backend/*` into this service and Vercel does not
        rewrite the path on the way in, so `URL_PREFIX` in the production
        settings has to name the same segment. When it doesn't, every request
        reaches Django under a path its URLconf has never heard of and the
        whole API 404s while looking perfectly healthy — which is exactly the
        failure this mounting replaced.
        """
        prefix = _backend_public_prefix(json.loads(_vercel_json().read_text()))
        prod = Path(settings.BASE_DIR) / "config" / "settings" / "prod.py"

        # Read as text rather than imported: importing prod.py requires a
        # secret key and would swap the settings out from under the suite.
        self.assertIn(
            f'os.environ.get("DJANGO_URL_PREFIX", "{prefix.lstrip("/")}")',
            prod.read_text(),
        )
