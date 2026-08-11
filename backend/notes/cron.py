"""The purge trigger for deployments that can't run `celery beat`.

Beat is a long-lived process, and Vercel has none — so on Vercel a Cron Job
(the `crons` entry in backend/vercel.json) hits the endpoint below on a
schedule and it enqueues the very same task beat would have. Under
docker-compose beat still drives it and nothing calls this. Two triggers,
one task: see CELERY_BEAT_SCHEDULE in config/settings/base.py.

This is a plain Django view rather than a DRF one on purpose. Vercel Cron
authenticates with `Authorization: Bearer $CRON_SECRET`, and DRF's default
authentication class here is JWTAuthentication — it would try to decode that
secret as a JWT and reject the request with a 401 before any permission
check of ours ran.
"""

import hmac
import logging
import os

from django.http import HttpResponseNotAllowed, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .tasks import purge_archived_notes

logger = logging.getLogger(__name__)


@csrf_exempt
def purge_archived_notes_cron(request):
    """Enqueue the archive purge. Requires Vercel's cron bearer token.

    Returns the Celery task id — the work itself happens in the worker
    (a queue-triggered Function on Vercel), not in this request.
    """
    if request.method not in ("GET", "POST"):
        # Vercel Cron sends GET; POST is accepted so the endpoint can be
        # triggered by hand without pretending a delete is idempotent.
        return HttpResponseNotAllowed(["GET", "POST"])

    # Read at call time, not import time, so a missing secret is a runtime
    # 503 on this one endpoint rather than a dead deployment.
    secret = os.environ.get("CRON_SECRET")
    if not secret:
        # Fail closed. Without a secret this endpoint would let anyone on
        # the internet trigger a permanent delete.
        logger.error("CRON_SECRET is not set; refusing to run the archive purge.")
        return JsonResponse({"detail": "Cron is not configured."}, status=503)

    provided = request.headers.get("Authorization", "")
    # Compared as bytes: hmac.compare_digest raises TypeError on a str with
    # non-ASCII in it, and the header is attacker-controlled.
    if not hmac.compare_digest(provided.encode("utf-8", "ignore"), f"Bearer {secret}".encode()):
        return JsonResponse({"detail": "Unauthorized."}, status=401)

    result = purge_archived_notes.delay()
    logger.info("Enqueued archive purge (task id %s).", result.id)
    return JsonResponse({"taskId": result.id}, status=202)
