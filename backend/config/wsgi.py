"""WSGI config for the note-taking app project."""

import os

from django.core.wsgi import get_wsgi_application

# On Vercel this module *is* the deployed function (see [tool.vercel] in
# pyproject.toml); everywhere else it's the docker-compose server. See the
# comment in manage.py.
os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings.prod" if os.environ.get("VERCEL") else "config.settings.dev",
)

application = get_wsgi_application()
