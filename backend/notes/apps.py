from django.apps import AppConfig


class NotesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "notes"

    def ready(self):
        from django.conf import settings
        from django.db.models.signals import post_save

        from . import signals

        post_save.connect(signals.create_default_category, sender=settings.AUTH_USER_MODEL)
