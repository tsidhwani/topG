import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Off: every page here is per-user/dynamic (auth, bets, admin data), so
  // there's nothing to cache and it would just force "use cache"/Suspense
  // annotations on every route.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
