"""Vercel build step: apply migrations before the new code serves traffic.

Wired up by [tool.vercel.scripts] in pyproject.toml. Vercel runs this after
installing dependencies and before the deployment goes live, which is the
only window where the schema can be moved ahead of the code that needs it.
(`collectstatic` is not called here — Vercel runs it for us because
STATIC_ROOT is set.)

Production only, deliberately. Preview deployments read whichever database
their environment variables name, and in a single-database setup that is the
production one — so migrating from a preview would apply a branch's schema
change to live data, from a deploy nobody considers a release. Previews run
against the schema production last migrated; a preview whose code needs a
newer schema will fail loudly, which is the correct outcome.
"""

import os
import subprocess
import sys


def main():
    vercel_env = os.environ.get("VERCEL_ENV")

    if vercel_env != "production":
        print(f"build.py: VERCEL_ENV={vercel_env!r}, skipping migrations.")
        return

    if not os.environ.get("DATABASE_URL"):
        # Fail here rather than let the deployment go live: without it,
        # settings fall back to a localhost Postgres that does not exist
        # inside a Function, and every request 500s with a connection
        # refused to 127.0.0.1:5432 — a symptom that names nothing.
        sys.exit(
            "build.py: DATABASE_URL is not set. Add a Postgres integration "
            "to this Vercel project (use the provider's pooled endpoint) "
            "before deploying to production."
        )

    print("build.py: applying migrations...")
    subprocess.run(
        [sys.executable, "manage.py", "migrate", "--noinput"],
        check=True,  # a failed migration must fail the build, not ship
    )
    print("build.py: migrations applied.")


if __name__ == "__main__":
    main()
