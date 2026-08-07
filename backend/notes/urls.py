from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet, NoteViewSet

router = DefaultRouter()
router.register("notes", NoteViewSet, basename="note")
router.register("categories", CategoryViewSet, basename="category")

urlpatterns = router.urls
