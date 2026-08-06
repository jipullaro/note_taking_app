from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Note
from .permissions import IsOwner
from .serializers import NoteSerializer


class NoteViewSet(viewsets.ModelViewSet):
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self):
        queryset = Note.objects.filter(owner=self.request.user)

        category = self.request.query_params.get("category")
        if category is not None:
            if category not in Note.Category.values:
                raise ValidationError({"category": f"'{category}' is not a valid category."})
            queryset = queryset.filter(category=category)

        return queryset

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=False, methods=["get"])
    def counts(self, request):
        rows = (
            Note.objects.filter(owner=request.user)
            .values("category")
            .annotate(count=Count("id"))
        )
        counts = {key: 0 for key in Note.Category.values}
        for row in rows:
            counts[row["category"]] = row["count"]
        counts["all"] = sum(counts.values())
        return Response(counts, status=status.HTTP_200_OK)
