from rest_framework import serializers

from .models import Category, Note


class CategoryPositionMixin:
    """Supplies `position`: a category's 0-based index in its owner's own
    list, i.e. "this is your third category".

    It's derived rather than stored, from Category.objects.positions() — the
    one definition of that order (notes/models.py). The id can't stand in for
    it: the id sequence is global, so the second user to register gets ids
    that start wherever the first user's left off.

    The map is built once per request and cached on the serializer context,
    which is what keeps the nested-in-a-note case (below) from becoming a
    query per note on the list endpoint. Serializers declare the field
    themselves — DRF's metaclass only collects declared fields from
    Serializer bases, so a field declared here would be dropped.
    """

    def get_position(self, category):
        cache = self.context.setdefault("category_positions", {})
        if category.owner_id not in cache:
            cache[category.owner_id] = Category.objects.filter(
                owner_id=category.owner_id
            ).positions()
        # A miss means the category was deleted mid-request; 0 is as good an
        # answer as any for a row that no longer exists, and beats a 500.
        return cache[category.owner_id].get(category.id, 0)


class CategorySerializer(CategoryPositionMixin, serializers.ModelSerializer):
    position = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ("id", "name", "created_at", "position")
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


class CategoryMiniSerializer(CategoryPositionMixin, serializers.ModelSerializer):
    """Nested read-only representation used when a note reports its
    category. Colors live only on the frontend (see frontend/src/lib/categories.ts) —
    this deliberately carries no color data. `position` isn't an exception to
    that: it's an ordering fact about the user's category list, which the
    frontend happens to color from. A note card only ever holds its own
    category, never the user's list, so without this it couldn't tell which
    one it was looking at."""

    position = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ("id", "name", "position")


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
