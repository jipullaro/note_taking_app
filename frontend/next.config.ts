import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" exists for the Docker image, which needs a self-contained
  // server bundle. Vercel builds its own output from the default build and
  // ignores this — leaving it on there just traces and copies the runtime a
  // second time, for nothing. VERCEL is set on every Vercel build.
  output: process.env.VERCEL ? undefined : "standalone",

  // Serve images straight from `src` instead of through /_next/image.
  //
  // On Vercel, /_next/image is provided by the platform *in front of* the
  // application. This app is deployed as a service (see `services` in the
  // root vercel.json), where the top-level rewrite table is ours: /_next/image
  // matches the `/(.*)` catch-all, gets handed to the Next server, and 404s,
  // because on Vercel the optimizer was never part of the server bundle. The
  // asset itself is fine — /mascots/login_image.png serves a byte-identical
  // 200 — so every <Image> rendered a broken img with a working file behind
  // it.
  //
  // Deliberately not gated on VERCEL, unlike `output` above. The whole cost
  // of this bug was that it existed only in one environment; matching the
  // rendered markup everywhere means the next one reproduces locally. The
  // price is that the mascot PNGs ship at full size — worth trimming at the
  // source, since nothing resizes them now.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
