from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import EmailTokenObtainPairView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/auth/token/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/", include("notes.urls")),
]

# Where Django doesn't own the domain root, every route above moves under a
# prefix (see URL_PREFIX in config/settings/base.py). Nesting the real
# patterns rather than stripping the prefix from the incoming path keeps
# reverse() honest: it returns the URL a browser can actually request, so the
# admin's own login redirect lands back on the admin instead of on whatever
# else is serving that domain.
#
# The prefix is stripped of slashes here as well as where it's read from the
# environment, so that a value typed by hand into a Vercel env var as
# "/backend/" mounts the same routes as "backend" instead of producing
# "//backend/api/..." with nothing to explain why.
if settings.URL_PREFIX:
    urlpatterns = [path(f"{settings.URL_PREFIX.strip('/')}/", include(urlpatterns))]
