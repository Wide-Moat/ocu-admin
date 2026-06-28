// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect } from "vitest"
import {
  createHttpReadClient,
  ReadUnavailableError,
  parsePrometheusHistogram,
  type ReadClient,
} from "../client"
import { fixtureSessions, fixtureStartHistogram } from "../fixture"
import type { SessionView } from "../types"

// The HTTP read client is the seam page.tsx depends on. These tests drive it
// against an injected `fetch` (the only outward dependency), so they assert the
// four GET endpoints, the Prometheus-text → StartHistogram parser, and the
// typed ReadUnavailableError on a non-2xx — the 503 / BoundedReason path the
// Dashboard renders as state="unavailable". No real network is touched.

// A fetch stub that routes by URL suffix to a canned Response.
function stubFetch(routes: Record<string, () => Response>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString()
    for (const [suffix, make] of Object.entries(routes)) {
      if (url.endsWith(suffix)) {
        return make()
      }
    }
    return new Response("not found", { status: 404 })
  }) as typeof fetch
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

// A Prometheus exposition matching the fixture histogram (le-ascending buckets,
// a _sum and a _count). The leading metric name is arbitrary; the parser keys
// off the *_bucket{le=...} / *_sum / *_count suffixes.
const PROM_TEXT = `# HELP ocu_session_start_seconds reserved->active duration
# TYPE ocu_session_start_seconds histogram
ocu_session_start_seconds_bucket{le="2.5"} 1
ocu_session_start_seconds_bucket{le="5.0"} 5
ocu_session_start_seconds_bucket{le="7.5"} 9
ocu_session_start_seconds_bucket{le="10.0"} 11
ocu_session_start_seconds_bucket{le="30.0"} 12
ocu_session_start_seconds_bucket{le="+Inf"} 12
ocu_session_start_seconds_sum 78
ocu_session_start_seconds_count 12
`

describe("createHttpReadClient", () => {
  it("conforms to the ReadClient interface", () => {
    const client: ReadClient = createHttpReadClient("https://bff.example")
    expect(typeof client.listSessions).toBe("function")
    expect(typeof client.getSession).toBe("function")
    expect(typeof client.getDeployment).toBe("function")
    expect(typeof client.getMetrics).toBe("function")
  })

  it("listSessions GETs /v1alpha/sessions and parses the rows", async () => {
    const client = createHttpReadClient("https://bff.example", {
      fetch: stubFetch({
        "/v1alpha/sessions": () => json(fixtureSessions),
      }),
    })
    const rows = await client.listSessions()
    expect(rows).toHaveLength(fixtureSessions.length)
    expect(rows[0].key).toBe(fixtureSessions[0].key)
  })

  it("listSessions adds ?include_released when asked", async () => {
    let seenUrl = ""
    const client = createHttpReadClient("https://bff.example", {
      fetch: (async (input: string | URL | Request) => {
        seenUrl = typeof input === "string" ? input : input.toString()
        return json(fixtureSessions)
      }) as typeof fetch,
    })
    await client.listSessions({ includeReleased: true })
    expect(seenUrl).toContain("/v1alpha/sessions")
    expect(seenUrl).toContain("include_released")
  })

  it("getSession returns the row on 200", async () => {
    const target = fixtureSessions[0]
    const client = createHttpReadClient("https://bff.example", {
      fetch: stubFetch({
        [`/v1alpha/sessions/${target.key}`]: () => json(target),
      }),
    })
    const row = await client.getSession(target.key)
    expect(row?.key).toBe(target.key)
  })

  it("getSession returns null on 404", async () => {
    const client = createHttpReadClient("https://bff.example", {
      fetch: stubFetch({
        "/v1alpha/sessions/missing": () => new Response(null, { status: 404 }),
      }),
    })
    const row: SessionView | null = await client.getSession("missing")
    expect(row).toBeNull()
  })

  it("getDeployment GETs /v1alpha/deployment", async () => {
    const client = createHttpReadClient("https://bff.example", {
      fetch: stubFetch({
        "/v1alpha/deployment": () =>
          json({ runtime_tier: "firecracker", runtime_provider: "docker" }),
      }),
    })
    const dep = await client.getDeployment()
    expect(dep.runtime_tier).toBe("firecracker")
    expect(dep.runtime_provider).toBe("docker")
  })

  it("getMetrics GETs /metrics and parses the Prometheus histogram", async () => {
    const client = createHttpReadClient("https://bff.example", {
      fetch: stubFetch({
        "/metrics": () =>
          new Response(PROM_TEXT, {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
      }),
    })
    const h = await client.getMetrics()
    expect(h.sum_seconds).toBe(78)
    expect(h.observation_count).toBe(12)
    // The +Inf bucket is dropped; the finite buckets match the fixture.
    expect(h.buckets).toHaveLength(fixtureStartHistogram.buckets.length)
    expect(h.buckets[0]).toEqual({ le: 2.5, cumulative_count: 1 })
  })

  it("throws a typed ReadUnavailableError carrying the status on a non-2xx", async () => {
    const client = createHttpReadClient("https://bff.example", {
      fetch: stubFetch({
        "/v1alpha/sessions": () => new Response(null, { status: 503 }),
      }),
    })
    await expect(client.listSessions()).rejects.toBeInstanceOf(
      ReadUnavailableError,
    )
    try {
      await client.listSessions()
    } catch (e) {
      expect(e).toBeInstanceOf(ReadUnavailableError)
      expect((e as ReadUnavailableError).status).toBe(503)
    }
  })
})

describe("parsePrometheusHistogram", () => {
  it("parses *_bucket{le=...}, *_sum, *_count into StartHistogram", () => {
    const h = parsePrometheusHistogram(PROM_TEXT)
    expect(h.sum_seconds).toBe(78)
    expect(h.observation_count).toBe(12)
    expect(h.buckets.map((b) => b.le)).toEqual([2.5, 5.0, 7.5, 10.0, 30.0])
    expect(h.buckets.map((b) => b.cumulative_count)).toEqual([1, 5, 9, 11, 12])
  })

  it("ignores the +Inf bucket and HELP/TYPE comment lines", () => {
    const h = parsePrometheusHistogram(PROM_TEXT)
    expect(h.buckets.every((b) => Number.isFinite(b.le))).toBe(true)
  })

  it("yields a zeroed histogram on an empty exposition", () => {
    const h = parsePrometheusHistogram("")
    expect(h.buckets).toEqual([])
    expect(h.sum_seconds).toBe(0)
    expect(h.observation_count).toBe(0)
  })
})
