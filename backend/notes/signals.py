from .models import Category


def create_default_category(sender, instance, created, **kwargs):
    """Seed every new user with a single "Personal" category.

    It's just a starting point, not a protected default — the user can
    rename or delete it like any other category once it's empty.
    """
    if created:
        Category.objects.get_or_create(owner=instance, name="Personal")
