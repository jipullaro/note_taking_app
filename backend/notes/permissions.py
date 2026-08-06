from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    """Object-level check that the requesting user owns the note.

    The queryset is already scoped to the current user's notes, so this is
    defense-in-depth rather than the primary access control.
    """

    def has_object_permission(self, request, view, obj):
        return obj.owner_id == request.user.id
