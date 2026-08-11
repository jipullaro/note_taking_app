#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""

import os
import sys


def main():
    """Run administrative tasks."""
    # Vercel executes this file during the build to discover the settings
    # module and the WSGI entrypoint, so the default has to be right there
    # without any project configuration. VERCEL is set in Vercel's build and
    # runtime environments and nowhere else. Same three lines in wsgi.py,
    # asgi.py, celery.py and worker.py — see config/settings/prod.py.
    os.environ.setdefault(
        "DJANGO_SETTINGS_MODULE",
        "config.settings.prod" if os.environ.get("VERCEL") else "config.settings.dev",
    )
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
