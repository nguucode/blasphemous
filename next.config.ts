import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E runs its own dev server next to the normal one; a separate build folder keeps them apart.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // A save carries the brand images as data URLs: logo 200 KB + background 1.5 MB, base64 adds a third.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
