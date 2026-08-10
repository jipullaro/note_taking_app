from django.conf import settings
from django.db import models
from django.utils import timezone


class CategoryQuerySet(models.QuerySet):
    def ordered(self):
        """The order a user's categories are presented in, everywhere.

        Meta.ordering already says created_at; `id` is added as a tiebreak so
        two categories created in the same instant can't swap places between
        requests. That matters more than it looks: `positions()` below is an
        index into this order, and the frontend colors the first few
        categories from a fixed palette off it (frontend/src/lib/categories.ts),
        so an unstable order would be a category changing color.
        """
        return self.order_by("created_at", "id")

    def positions(self):
        """{category id: its 0-based index in `ordered()`}.

        One query for the whole set, so serializing N notes that each nest
        their category doesn't turn into N COUNTs. Call it on an owner's full
        category set — a filtered or sliced queryset would number the rows it
        happens to contain, not the user's actual list.
        """
        return {pk: index for index, pk in enumerate(self.ordered().values_list("id", flat=True))}


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

    objects = CategoryQuerySet.as_manager()

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "name"], name="unique_category_name_per_owner"
            ),
        ]

    def __str__(self):
        return self.name


class NoteQuerySet(models.QuerySet):
    """Named filters for the archive lifecycle.

    A note is "live" while `archived_at` is NULL, "archived" once it's set,
    and purgeable once it's been archived longer than the retention window.
    """

    def active(self):
        return self.filter(archived_at__isnull=True)

    def archived(self):
        return self.filter(archived_at__isnull=False)

    def purgeable(self, before):
        """Archived strictly before `before` — i.e. past the retention window."""
        return self.filter(archived_at__isnull=False, archived_at__lt=before)


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
    # NULL means live. Deleting a note through the API sets this instead of
    # dropping the row (see NoteViewSet.perform_destroy); a Celery job purges
    # rows past the retention window for good.
    archived_at = models.DateTimeField(null=True, blank=True, db_index=True)

    # The default manager stays UNFILTERED on purpose — it does not hide
    # archived rows. Two things break if it does:
    #   1. The purge job looks for archived notes; a manager that hides them
    #      would make the job a no-op against its own targets.
    #   2. `category.notes` would silently start meaning "live notes only",
    #      while Django's cascade collector keeps using `_base_manager` and
    #      so would still take archived notes down with a deleted category —
    #      two different answers to "what notes does this category have".
    # Filtering stays explicit and named at the call site: `.active()` /
    # `.archived()`.
    objects = NoteQuerySet.as_manager()

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title or f"Note #{self.pk}"

    def archive(self):
        """Move the note to the archive (a soft delete on a countdown)."""
        self.archived_at = timezone.now()
        # `update_fields` is load-bearing, not an optimization: it stops
        # `updated_at`'s auto_now from firing. Archiving isn't an edit, so it
        # must not bump "Last Edited" or reshuffle the `-updated_at` ordering
        # a restore would otherwise land in. A refactor to a plain `.save()`
        # would break both, silently.
        self.save(update_fields=["archived_at"])

    def restore(self):
        """Bring an archived note back to the dashboard."""
        self.archived_at = None
        # Same reason as archive(): restoring isn't an edit either, so the
        # note returns to the spot in the list it was archived from.
        self.save(update_fields=["archived_at"])
