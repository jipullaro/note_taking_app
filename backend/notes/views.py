from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Category, Note
from .permissions import IsOwner
from .serializers import CategorySerializer, NoteSerializer


class NoteViewSet(viewsets.ModelViewSet):
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self):
        queryset = Note.objects.filter(owner=self.request.user).select_related("category")

        # The archive split is action-aware rather than a single filter:
        # `restore` is the only action that may touch an archived note, and
        # every other detail action must not — so an archived note 404s in
        # the editor (which autosaves, and would otherwise keep PATCHing a
        # note the user thinks is deleted) and can't be deleted twice.
        if self.action == "restore":
            queryset = queryset.archived()
        elif self.action == "list":
            queryset = self._apply_archived_filter(queryset)
        else:
            queryset = queryset.active()

        category = self.request.query_params.get("category")
        if category is not None:
            if (
                not category.isdigit()
                or not Category.objects.filter(id=category, owner=self.request.user).exists()
            ):
                raise ValidationError({"category": f"'{category}' is not a valid category."})
            queryset = queryset.filter(category_id=category)

        return queryset

    def _apply_archived_filter(self, queryset):
        """`?archived=true|false` on the list endpoint, defaulting to false.

        Deliberately as strict as the `?category=` filter above: anything
        other than the two accepted values is a 400 rather than a silent
        fallback to the live notes, so a typo can't quietly show the wrong
        list.
        """
        archived = self.request.query_params.get("archived")
        if archived is None or archived == "false":
            return queryset.active()
        if archived == "true":
            # Newest-archived first: the archive is a countdown, so the most
            # recently archived (and so most likely to be restored) leads.
            return queryset.archived().order_by("-archived_at")
        raise ValidationError(
            {"archived": f"'{archived}' is not a valid value. Use true or false."}
        )

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_destroy(self, instance):
        # DELETE archives instead of destroying. DRF still replies 204, so
        # the frontend's delete contract is unchanged — only the outcome is
        # now reversible, via the `restore` action below.
        instance.archive()

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        note = self.get_object()  # queryset is scoped to archived notes for this action
        note.restore()
        return Response(self.get_serializer(note).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"])
    def counts(self, request):
        categories = Category.objects.filter(owner=request.user)
        rows = (
            Note.objects.filter(owner=request.user)
            .active()
            .values("category_id")
            .annotate(count=Count("id"))
        )
        note_counts = {row["category_id"]: row["count"] for row in rows}
        categories_payload = [
            {"id": c.id, "name": c.name, "count": note_counts.get(c.id, 0)} for c in categories
        ]
        return Response(
            {
                "categories": categories_payload,
                "all": sum(note_counts.values()),
                "archived": Note.objects.filter(owner=request.user).archived().count(),
            },
            status=status.HTTP_200_OK,
        )


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self):
        return Category.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Only ACTIVE notes block the delete. Archived ones go down with the
        # category via CASCADE, deliberately: an archived note is already in
        # the user's trash on a countdown, so blocking on it would strand
        # them for a day behind a message about notes they can't see in the
        # category they're trying to delete. It also makes restoring into a
        # since-deleted category unrepresentable.
        if instance.notes.active().exists():
            return Response(
                {"detail": "This category still has notes in it. Move or delete them first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)
