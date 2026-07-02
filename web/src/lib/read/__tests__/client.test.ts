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
import { START_HISTOGRAM_METRIC } from "../prometheus"
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
// a _sum and a _count). The metric name is load-bearing: the parser is anchored
// to the family it is asked for, so these lines must carry the canonical
// START_HISTOGRAM_METRIC name.
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

// A fleet-realistic exposition: the canon family flanked by other families with
// wildly different numbers, as any real /metrics endpoint exposes (process_/
// go_/http_ families). One histogram family follows the canon one, so both a
// bucket-merging parser and a last-wins _sum/_count parser are caught.
const MULTI_FAMILY_TEXT =
  PROM_TEXT +
  `# HELP process_request_seconds unrelated request latency
# TYPE process_request_seconds histogram
process_request_seconds_bucket{le="0.1"} 1000
process_request_seconds_bucket{le="0.5"} 4000
process_request_seconds_bucket{le="+Inf"} 9000
process_request_seconds_sum 1234.5
process_request_seconds_count 9000
`

// The canon family present but never observed: an honest zero, not an absence.
const ZERO_OBSERVATIONS_TEXT = `# TYPE ocu_session_start_seconds histogram
ocu_session_start_seconds_bucket{le="+Inf"} 0
ocu_session_start_seconds_sum 0
ocu_session_start_seconds_count 0
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

  it("getMetrics reads only the canon family from a multi-family exposition", async () => {
    const client = createHttpReadClient("https://bff.example", {
      fetch: stubFetch({
        "/metrics": () =>
          new Response(MULTI_FAMILY_TEXT, {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
      }),
    })
    const h = await client.getMetrics()
    expect(h.sum_seconds).toBe(78)
    expect(h.observation_count).toBe(12)
    expect(h.buckets.map((b) => b.le)).toEqual([2.5, 5.0, 7.5, 10.0, 30.0])
    expect(h.buckets.map((b) => b.cumulative_count)).toEqual([1, 5, 9, 11, 12])
  })

  it("getMetrics rejects with ReadUnavailableError(502) when the exposition lacks the family", async () => {
    // A 200 whose body is not the read surface's data (an HTML error page from
    // some intermediary): serving it as a zeroed histogram would fabricate an
    // avg-start-time tile. The read is unavailable, status 502.
    const client = createHttpReadClient("https://bff.example", {
      fetch: stubFetch({
        "/metrics": () =>
          new Response("<html><body>service temporarily down</body></html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
      }),
    })
    await expect(client.getMetrics()).rejects.toBeInstanceOf(
      ReadUnavailableError,
    )
    try {
      await client.getMetrics()
    } catch (e) {
      expect((e as ReadUnavailableError).status).toBe(502)
    }
  })

  it("getMetrics rejects with 502 on an empty exposition", async () => {
    // BEHAVIOR CHANGE, not a test deletion: the old contract parsed an empty
    // exposition to a zeroed histogram and served it as an honest 200. The new
    // contract: no line of the family (no bucket, no sum, no count) means the
    // endpoint did not answer with the read surface's data -> 502.
    const client = createHttpReadClient("https://bff.example", {
      fetch: stubFetch({
        "/metrics": () =>
          new Response("", {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
      }),
    })
    await expect(client.getMetrics()).rejects.toBeInstanceOf(
      ReadUnavailableError,
    )
    try {
      await client.getMetrics()
    } catch (e) {
      expect((e as ReadUnavailableError).status).toBe(502)
    }
  })

  it("getMetrics returns an honest zeroed histogram when the family is present with zero observations", async () => {
    // Present-but-zero is NOT absence: a deployment that has started no
    // sessions yet reports count 0 honestly, it does not go unavailable.
    const client = createHttpReadClient("https://bff.example", {
      fetch: stubFetch({
        "/metrics": () =>
          new Response(ZERO_OBSERVATIONS_TEXT, {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
      }),
    })
    const h = await client.getMetrics()
    expect(h.buckets).toEqual([])
    expect(h.sum_seconds).toBe(0)
    expect(h.observation_count).toBe(0)
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
  it("parses <metric>_bucket{le=...}, <metric>_sum, <metric>_count into StartHistogram", () => {
    const h = parsePrometheusHistogram(PROM_TEXT, START_HISTOGRAM_METRIC)
    expect(h.sum_seconds).toBe(78)
    expect(h.observation_count).toBe(12)
    expect(h.buckets.map((b) => b.le)).toEqual([2.5, 5.0, 7.5, 10.0, 30.0])
    expect(h.buckets.map((b) => b.cumulative_count)).toEqual([1, 5, 9, 11, 12])
  })

  it("ignores the +Inf bucket and HELP/TYPE comment lines", () => {
    const h = parsePrometheusHistogram(PROM_TEXT, START_HISTOGRAM_METRIC)
    expect(h.buckets.every((b) => Number.isFinite(b.le))).toBe(true)
  })

  it("reads only the anchored family from a multi-family exposition", () => {
    // The chimera probe: an unanchored parser merges the other family's
    // buckets (non-monotonic cumulative counts) and lets its _sum/_count
    // clobber the canon family's. Every number must be the canon family's.
    const h = parsePrometheusHistogram(
      MULTI_FAMILY_TEXT,
      START_HISTOGRAM_METRIC,
    )
    expect(h.sum_seconds).toBe(78)
    expect(h.observation_count).toBe(12)
    expect(h.buckets.map((b) => b.le)).toEqual([2.5, 5.0, 7.5, 10.0, 30.0])
    expect(h.buckets.map((b) => b.cumulative_count)).toEqual([1, 5, 9, 11, 12])
  })

  it("yields a zeroed histogram when the family is absent (parse-only contract)", () => {
    // BEHAVIOR-CHANGE NOTE: this used to pin "empty exposition -> zeroed
    // histogram" as the getMetrics-visible contract. The parser stays pure —
    // no family lines parse to zero — but getMetrics now maps family absence
    // to ReadUnavailableError(502) (pinned above), so a zeroed parse never
    // reaches the dashboard as a fabricated 200.
    for (const text of ["", "<html>gateway error</html>"]) {
      const h = parsePrometheusHistogram(text, START_HISTOGRAM_METRIC)
      expect(h.buckets).toEqual([])
      expect(h.sum_seconds).toBe(0)
      expect(h.observation_count).toBe(0)
    }
  })
})
