"""URL_PREFIX moves the whole URLconf under a public path prefix.

This is a project-level concern rather than a notes one, but pytest's
`testpaths` (see pyproject.toml) only collects `accounts` and `notes`, so it
lives here to actually run.

Why it exists: on Vercel the Django service shares a domain with the Next.js
app and is published under /backend/*. Vercel hands the service the original
request path — the prefix is NOT stripped on the way in — so Django has to
own those paths for real. Mounting them in the URLconf, rather than rewriting
the path at the edge, is also what keeps reverse() returning URLs a browser
can actually request: the admin's login redirect included.
"""

import importlib

from django.test import SimpleTestCase, override_settings
from django.urls import clear_url_caches, reverse

import config.urls


def reload_urlconf():
    """Rebuild the URLconf against the currently active settings.

    config/urls.py branches on settings.URL_PREFIX at import time, so
    override_settings alone changes nothing — the module has to be
    re-executed and Django's resolver cache dropped.
    """
    importlib.reload(config.urls)
    clear_url_caches()


class UrlPrefixTests(SimpleTestCase):
    def tearDown(self):
        # Restore the unprefixed URLconf. Without this, a reload inside one
        # test leaks a prefixed resolver into every test that follows.
        reload_urlconf()

    def test_no_prefix_by_default(self):
        # What docker-compose gets: Django has its own port, so it owns "/".
        self.assertEqual(reverse("cron-purge-archived-notes"), "/api/cron/purge-archived-notes/")
        self.assertEqual(reverse("register"), "/api/auth/register/")
        # The path docker-compose's healthcheck asks for, spelled out there.
        self.assertEqual(reverse("health"), "/api/health/")

    def test_every_route_moves_under_the_prefix(self):
        with override_settings(URL_PREFIX="backend"):
            reload_urlconf()

            self.assertEqual(
                reverse("cron-purge-archived-notes"),
                "/backend/api/cron/purge-archived-notes/",
            )
            self.assertEqual(reverse("register"), "/backend/api/auth/register/")
            self.assertEqual(reverse("token_obtain_pair"), "/backend/api/auth/token/")
            # Where an uptime monitor pointed at the deployment has to ask.
            self.assertEqual(reverse("health"), "/backend/api/health/")

    def test_admin_moves_too_so_its_own_redirects_stay_inside_the_prefix(self):
        # The admin builds its login redirect with reverse(). If the prefix
        # were stripped at the edge instead of mounted here, that redirect
        # would point at /admin/login/ — a path served by the *frontend* on
        # the shared domain.
        with override_settings(URL_PREFIX="backend"):
            reload_urlconf()

            self.assertEqual(reverse("admin:index"), "/backend/admin/")

    def test_surrounding_slashes_are_tolerated(self):
        # The value is typed into a Vercel env var by hand. "/backend/" has
        # to mount the same routes as "backend", not "//backend/api/...".
        with override_settings(URL_PREFIX="/backend/"):
            reload_urlconf()

            self.assertEqual(reverse("register"), "/backend/api/auth/register/")
