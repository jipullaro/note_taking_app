import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" exists for the Docker image, which needs a self-contained
  // server bundle. Vercel builds its own output from the default build and
  // ignores this — leaving it on there just traces and copies the runtime a
  // second time, for nothing. VERCEL is set on every Vercel build.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
