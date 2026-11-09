import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // The demo is a client-rendered app: all data comes from a mock store in
    // localStorage, so screens render after hydration. Only validate segments
    // that explicitly opt in via `export const instant`. Revisit once screens
    // fetch from the real API on the server.
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
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
