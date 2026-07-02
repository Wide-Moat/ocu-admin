// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // The read client and page.tsx speak the frozen ADR-0022 read surface
  // (/v1alpha/*, /metrics), but the BFF route handlers are mounted under
  // /api/read/* so the import-boundary pin (^src/app/api) covers them. These
  // rewrites bridge the two server-side: a canon request is served by its
  // handler with no client change. The :path* form carries the session paths
  // (list + single key); /metrics has no /v1alpha prefix, so it is mapped on
  // its own.
  async rewrites() {
    return [
      { source: "/v1alpha/:path*", destination: "/api/read/:path*" },
      { source: "/metrics", destination: "/api/read/metrics" },
    ]
  },
}

export default nextConfig
