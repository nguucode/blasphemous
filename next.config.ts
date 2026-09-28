import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E runs its own dev server next to the normal one; a separate build folder keeps them apart.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
