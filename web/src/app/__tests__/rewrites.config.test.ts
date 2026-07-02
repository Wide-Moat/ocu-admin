// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// The canon read paths vs. the mounted routes. The read client and page.tsx
// speak the frozen ADR-0022 surface — `/v1alpha/sessions`, `/v1alpha/sessions/
// {key}`, `/v1alpha/deployment`, `/metrics` — but the BFF route handlers are
// mounted under `/api/read/*` (where the import-boundary pin covers them). A
// Next.js rewrite bridges the two: the browser/SSR client dials the canon path,
// Next rewrites it to the handler. Without the rewrite, every canon request
// 404s and the dashboard silently goes state="unavailable" — the exact bug
// page.test.tsx cannot catch, because it stubs the global fetch and never
// exercises the rewrite table. These tests pin the rewrite table directly, so
// removing a rewrite turns them RED.

import { describe, it, expect } from "vitest"
import nextConfig from "../../../next.config"

type Rewrite = { source: string; destination: string }

async function rewriteTable(): Promise<Rewrite[]> {
  expect(typeof nextConfig.rewrites).toBe("function")
  const result = await nextConfig.rewrites!()
  // Next allows an array or a {beforeFiles,afterFiles,fallback} object; this
  // config uses the simple array form.
  const list = Array.isArray(result) ? result : result.beforeFiles
  return list as Rewrite[]
}

describe("next.config rewrites — canon read paths -> mounted BFF routes", () => {
  it("maps the four canon read endpoints to their /api/read handlers", async () => {
    const table = await rewriteTable()

    const bySource = new Map(table.map((r) => [r.source, r.destination]))

    // The parameterized session paths ride a single :path* rewrite.
    expect(bySource.get("/v1alpha/:path*")).toBe("/api/read/:path*")
    // /metrics has no /v1alpha prefix, so it needs its own rewrite.
    expect(bySource.get("/metrics")).toBe("/api/read/metrics")
  })

  it("routes every canon path the read client dials through the rewrite table", async () => {
    const table = await rewriteTable()

    // Resolve a concrete request path against the rewrite table the way Next
    // does: first exact match, then the :path* prefix rewrite.
    function resolve(path: string): string | undefined {
      const exact = table.find((r) => r.source === path)
      if (exact) return exact.destination
      const prefixed = table.find((r) => r.source.endsWith("/:path*"))
      if (prefixed) {
        const base = prefixed.source.replace("/:path*", "")
        if (path.startsWith(base + "/")) {
          return prefixed.destination.replace(
            "/:path*",
            "/" + path.slice(base.length + 1),
          )
        }
      }
      return undefined
    }

    // The exact set of paths createHttpReadClient issues (see client.ts).
    expect(resolve("/v1alpha/sessions")).toBe("/api/read/sessions")
    expect(resolve("/v1alpha/sessions/sess-abc")).toBe(
      "/api/read/sessions/sess-abc",
    )
    expect(resolve("/v1alpha/deployment")).toBe("/api/read/deployment")
    expect(resolve("/metrics")).toBe("/api/read/metrics")
  })
})
