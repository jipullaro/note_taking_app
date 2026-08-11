"""ASGI config for the note-taking app project."""

import os

from django.core.asgi import get_asgi_application

# See the comment in manage.py. Note that Vercel prefers the ASGI
# entrypoint whenever ASGI_APPLICATION is set in settings — it deliberately
# is not, since every view here is sync.
os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings.prod" if os.environ.get("VERCEL") else "config.settings.dev",
)

application = get_asgi_application()
