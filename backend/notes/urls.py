from django.urls import path
from rest_framework.routers import DefaultRouter

from .cron import purge_archived_notes_cron
from .views import CategoryViewSet, NoteViewSet

router = DefaultRouter()
router.register("notes", NoteViewSet, basename="note")
router.register("categories", CategoryViewSet, basename="category")

# The cron route sits outside the router: it isn't a resource, it's an ops
# trigger authenticated by a shared secret rather than by a user's JWT.
# The trailing slash is load-bearing — vercel.json names this exact path,
# and without it every scheduled run would spend a redirect getting here.
urlpatterns = [
    *router.urls,
    path(
        "cron/purge-archived-notes/",
        purge_archived_notes_cron,
        name="cron-purge-archived-notes",
    ),
]
