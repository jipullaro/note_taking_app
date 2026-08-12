"""The health probe for the backend service.

Lives in config/ rather than in an app because it reports on the service as a
whole, not on notes or accounts — same reason urls.py does.

This is a plain Django view rather than a DRF one for the reason spelled out
at the top of notes/cron.py: DEFAULT_PERMISSION_CLASSES is IsAuthenticated,
so a DRF view here would answer every anonymous probe with a 401 and the
check would fail for a service that is perfectly healthy.

Readiness, not just liveness: the process answering at all already proves it
is alive, and a probe that only proves that would stay green through the one
outage the backend can't serve through — an unreachable database. So the
database is checked on every call. The Celery broker deliberately is not.
Nothing served by this service needs it: it is reached only when the purge
endpoint enqueues a task (see notes/cron.py), and folding it in here would
take the whole API out of rotation over a dependency that requests never
touch.
"""

import logging

from django.db import connection
from django.http import HttpResponseNotAllowed, JsonResponse
from django.views.decorators.cache import never_cache

logger = logging.getLogger(__name__)


@never_cache
def health(request):
    """Report whether this service can serve requests. 200 healthy, 503 not.

    `never_cache` is what keeps the answer honest — without it a CDN or proxy
    in front of the deployment is free to serve a cached 200 long after the
    database went away.
    """
    if request.method not in ("GET", "HEAD"):
        # Probes send GET (and HEAD, if they only look at the status line).
        return HttpResponseNotAllowed(["GET", "HEAD"])

    try:
        # A real round trip rather than `connection.ensure_connection()`:
        # with CONN_MAX_AGE the connection may be pooled and already dead,
        # which only surfaces when something is actually executed on it.
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        # Deliberately broad. A health endpoint that raises is strictly worse
        # than one reporting unhealthy: the 500 says "something is wrong"
        # without saying what, and it looks identical to a bug in this view.
        logger.exception("Health check failed: the database is unreachable.")
        # The exception text stays in the log. It can carry the connection
        # string, and this endpoint is unauthenticated and public.
        return JsonResponse({"status": "unhealthy", "database": "unreachable"}, status=503)

    return JsonResponse({"status": "ok", "database": "ok"})
