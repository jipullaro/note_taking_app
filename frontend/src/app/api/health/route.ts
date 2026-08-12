import { NextResponse } from "next/server";

/**
 * Health probe for the frontend service.
 *
 * Deliberately shallow: it answers for *this* service and does not call the
 * Django API. The two are separate services (see `services` in the repo-root
 * vercel.json) with separate probes, and a frontend that reported itself
 * unhealthy whenever the backend was down would turn one outage into two —
 * it can still serve every page that doesn't need the API, and the backend's
 * own probe at /backend/api/health/ is what reports on the backend.
 *
 * No `export const dynamic = "force-dynamic"` here on purpose. Route Handlers
 * are uncached by default, and that export is removed in Next 16 once Cache
 * Components is enabled — so it would read as a guarantee while quietly
 * being ignored. The timestamp below is what actually holds the line: it is
 * non-deterministic, so prerendering stops at it and the handler runs per
 * request even if Cache Components is turned on later.
 */
export async function GET() {
  return NextResponse.json(
    { status: "ok", timestamp: new Date().toISOString() },
    // Belt and braces with the above: keeps a CDN or proxy from serving a
    // cached 200 for a service that has since stopped answering.
    { headers: { "Cache-Control": "no-store" } },
  );
}
