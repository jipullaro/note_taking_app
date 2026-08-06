from django.conf import settings
from django.db import models


class Note(models.Model):
    class Category(models.TextChoices):
        PERSONAL = "personal", "Personal"
        SCHOOL = "school", "School"
        RANDOM_THOUGHTS = "random_thoughts", "Random Thoughts"
        DRAMA = "drama", "Drama"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notes"
    )
    title = models.CharField(max_length=255, blank=True, default="")
    body = models.TextField(blank=True, default="")
    category = models.CharField(
        max_length=32, choices=Category.choices, default=Category.PERSONAL
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title or f"Note #{self.pk}"
