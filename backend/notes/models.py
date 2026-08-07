from django.conf import settings
from django.db import models


class Category(models.Model):
    """A user-defined bucket for notes.

    Categories are private to their owner — there's no such thing as a
    global "Drama" category everyone shares. Every user gets a "Personal"
    category seeded on registration (see notes/signals.py) and can freely
    add, rename, or delete their own from there.
    """

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="categories"
    )
    name = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "name"], name="unique_category_name_per_owner"
            ),
        ]

    def __str__(self):
        return self.name


class Note(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notes"
    )
    title = models.CharField(max_length=255, blank=True, default="")
    body = models.TextField(blank=True, default="")
    # CASCADE here is about the DB staying consistent (e.g. deleting a user
    # should cleanly take their categories and notes with them), not about
    # product behavior — a category with notes can't be deleted through the
    # API regardless: see CategoryViewSet.destroy in notes/views.py. Using
    # PROTECT here instead would fight that same cascade on user deletion,
    # since Category.owner is CASCADE.
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="notes")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title or f"Note #{self.pk}"
