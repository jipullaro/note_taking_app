from django.contrib import admin

from .models import Category, Note


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "category", "created_at", "updated_at", "archived_at")
    list_filter = ("category", "archived_at")
    search_fields = ("title", "body", "owner__email")


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "created_at")
    search_fields = ("name", "owner__email")
