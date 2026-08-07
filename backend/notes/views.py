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

        category = self.request.query_params.get("category")
        if category is not None:
            if (
                not category.isdigit()
                or not Category.objects.filter(id=category, owner=self.request.user).exists()
            ):
                raise ValidationError({"category": f"'{category}' is not a valid category."})
            queryset = queryset.filter(category_id=category)

        return queryset

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=False, methods=["get"])
    def counts(self, request):
        categories = Category.objects.filter(owner=request.user)
        rows = (
            Note.objects.filter(owner=request.user)
            .values("category_id")
            .annotate(count=Count("id"))
        )
        note_counts = {row["category_id"]: row["count"] for row in rows}
        categories_payload = [
            {"id": c.id, "name": c.name, "count": note_counts.get(c.id, 0)} for c in categories
        ]
        return Response(
            {"categories": categories_payload, "all": sum(note_counts.values())},
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
        if instance.notes.exists():
            return Response(
                {"detail": "This category still has notes in it. Move or delete them first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)
