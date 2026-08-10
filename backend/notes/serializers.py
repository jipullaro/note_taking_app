from rest_framework import serializers

from .models import Category, Note


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "created_at")
        read_only_fields = ("id", "created_at")

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Category name can't be empty.")

        owner = self.context["request"].user
        clash = Category.objects.filter(owner=owner, name__iexact=value)
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("You already have a category with this name.")

        return value


class CategoryMiniSerializer(serializers.ModelSerializer):
    """Nested read-only representation used when a note reports its
    category. Colors live only on the frontend (see frontend/src/lib/categories.ts) —
    this deliberately carries no color data."""

    class Meta:
        model = Category
        fields = ("id", "name")


class NoteSerializer(serializers.ModelSerializer):
    category = CategoryMiniSerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category", queryset=Category.objects.none(), write_only=True
    )

    class Meta:
        model = Note
        fields = (
            "id",
            "title",
            "body",
            "category",
            "category_id",
            "created_at",
            "updated_at",
            "archived_at",
        )
        # `archived_at` is read-only on purpose: archiving happens through
        # DELETE and the `restore` action only, so there's exactly one code
        # path that sets it (Note.archive/restore) rather than a second one
        # via PATCH that would skip the update_fields those methods rely on.
        read_only_fields = ("id", "created_at", "updated_at", "archived_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request is not None:
            # Scope which categories can be assigned to this user's own —
            # also stops someone from filing a note under another user's
            # category id.
            self.fields["category_id"].queryset = Category.objects.filter(owner=request.user)
