import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("reports ok", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ok" });
  });

  it("is not cacheable", async () => {
    // A cached 200 keeps reporting health the service no longer has.
    const response = await GET();

    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("stamps each response, so it can't be prerendered into a static file", async () => {
    // The timestamp is load-bearing rather than decorative: it is what makes
    // the handler non-deterministic, which is what stops Next from
    // prerendering it at build time if Cache Components is ever enabled.
    // A health check served from a build artifact reports the build, not the
    // running service. See the comment in route.ts.
    const { timestamp } = await (await GET()).json();

    expect(Number.isNaN(Date.parse(timestamp))).toBe(false);
  });
});
