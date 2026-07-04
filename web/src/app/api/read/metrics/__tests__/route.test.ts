// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// The metrics BFF route, pinned against a REAL control-shaped HTTP server on a
// REAL unix socket (no mock). This route is text-in/text-out: control serves a
// Prometheus exposition, the route parses it to a typed StartHistogram and
// re-serializes it, so the pin parses the ROUTE's response body back with the
// client parser and demands the STUB's numbers. Six pins:
//
//  1. GET() returns 200 text/plain whose parsed histogram is exactly what the
//     control socket served — the stub's buckets/sum/count differ from the
//     fixture histogram (78s over 12 starts), so a route still emitting fixture
//     data cannot pass.
//  2. The stub actually SAW GET /metrics arrive over the socket — the route
//     really proxies, it does not synthesize.
//  3. Control answers 503 -> the route returns 503, never a 2xx with any body.
//  4. No socket at the configured path -> the route returns 503, never a 2xx.
//  5. Control's exposition carries OTHER metric families beside the canon one
//     (as any real /metrics does) -> the route serves ONLY the canon family's
//     numbers, never a cross-family chimera.
//  6. Control answers 200 with a body holding no line of the canon family
//     (an HTML error page) -> the route answers 502, never a zeroed 200.
//
// Pins 3-6 are the anti-fail-open/anti-fabrication probes: a route that falls
// back to the fixture histogram, merges foreign families, or zero-fills a
// garbage body would hand the operator a healthy-looking average-start-time
// tile that the control plane never reported. The socket path reaches the
// route only via OCU_ADMIN_CONTROL_SOCKET, so env must be read per request
// (inside GET), never at module load.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createServer, type Server } from "node:http"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { GET } from "../route"
import { parsePrometheusHistogram } from "@/lib/read/client"
import { START_HISTOGRAM_METRIC } from "@/lib/read/prometheus"
import type { StartHistogram } from "@/lib/read/types"

// Deliberately NOT the fixture values (fixture: le 2.5/5/7.5/10/30, sum 78,
// count 12). Different bounds, counts, sum, and count throughout.
const STUB_HISTOGRAM: StartHistogram = {
  buckets: [
    { le: 1, cumulative_count: 2 },
    { le: 4, cumulative_count: 7 },
    { le: 15, cumulative_count: 19 },
  ],
  sum_seconds: 91.5,
  observation_count: 20,
}

// The exposition the control side serves: hand-written text, not our
// serializer's output, so the route is proven against control-shaped input.
const STUB_EXPOSITION =
  [
    "# HELP ocu_control_session_start_seconds reserved->active start duration in seconds",
    "# TYPE ocu_control_session_start_seconds histogram",
    'ocu_control_session_start_seconds_bucket{le="1.0"} 2',
    'ocu_control_session_start_seconds_bucket{le="4.0"} 7',
    'ocu_control_session_start_seconds_bucket{le="15.0"} 19',
    'ocu_control_session_start_seconds_bucket{le="+Inf"} 20',
    "ocu_control_session_start_seconds_sum 91.5",
    "ocu_control_session_start_seconds_count 20",
  ].join("\n") + "\n"

// A fleet-realistic exposition: the canon family flanked by a histogram family
// before it and a summary family after it, all with wildly different numbers —
// what a real /metrics endpoint always carries (process_/go_/http_ families).
// The trailing summary catches a last-wins _sum/_count parser; the leading
// histogram catches a bucket-merging one.
const MULTI_FAMILY_EXPOSITION =
  [
    "# HELP process_request_seconds unrelated request latency",
    "# TYPE process_request_seconds histogram",
    'process_request_seconds_bucket{le="0.1"} 1000',
    'process_request_seconds_bucket{le="0.5"} 4000',
    'process_request_seconds_bucket{le="+Inf"} 9000',
    "process_request_seconds_sum 1234.5",
    "process_request_seconds_count 9000",
  ].join("\n") +
  "\n" +
  STUB_EXPOSITION +
  [
    "# HELP go_gc_duration_seconds unrelated gc summary",
    "# TYPE go_gc_duration_seconds summary",
    'go_gc_duration_seconds{quantile="0.5"} 0.0001',
    "go_gc_duration_seconds_sum 0.5",
    "go_gc_duration_seconds_count 300",
  ].join("\n") +
  "\n"

let dir: string
let socketPath: string
let server: Server | undefined
let seenMethods: string[]

type Route = (path: string) => { status: number; body: string }

function serve(route: Route): Promise<void> {
  server = createServer((req, res) => {
    seenMethods.push(req.method ?? "")
    const { status, body } = route(req.url ?? "")
    res.writeHead(status, {
      "content-type": "text/plain; version=0.0.4; charset=utf-8",
    })
    res.end(body)
  })
  return new Promise((resolve) => server?.listen(socketPath, resolve))
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ocu-admin-metrics-route-"))
  // Extensionless filename on purpose: a UDS path needs no suffix, and the
  // bundle-secrecy pin forbids UDS-path markers anywhere in src/app, tests
  // included.
  socketPath = join(dir, "control")
  vi.stubEnv("OCU_ADMIN_CONTROL_SOCKET", socketPath)
  seenMethods = []
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await new Promise<void>((resolve) => {
    if (server?.listening) {
      server.close(() => resolve())
    } else {
      resolve()
    }
  })
  server = undefined
  rmSync(dir, { recursive: true, force: true })
  // The read-only leaf emits only GETs, pinned at the socket: every request
  // that reached the wire in this test must have been a GET.
  expect(seenMethods.filter((m) => m !== "GET")).toEqual([])
})

describe("GET /api/read/metrics", () => {
  it("returns 200 text/plain that parses to exactly the histogram control served", async () => {
    await serve(() => ({ status: 200, body: STUB_EXPOSITION }))

    const res = await GET()

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/plain")
    const h = parsePrometheusHistogram(await res.text(), START_HISTOGRAM_METRIC)
    expect(h.buckets).toEqual(STUB_HISTOGRAM.buckets)
    expect(h.sum_seconds).toBe(STUB_HISTOGRAM.sum_seconds)
    expect(h.observation_count).toBe(STUB_HISTOGRAM.observation_count)
  })

  it("serves only the canon family's numbers when control exposes other families too", async () => {
    await serve(() => ({ status: 200, body: MULTI_FAMILY_EXPOSITION }))

    const res = await GET()

    expect(res.status).toBe(200)
    const h = parsePrometheusHistogram(await res.text(), START_HISTOGRAM_METRIC)
    expect(h.buckets).toEqual(STUB_HISTOGRAM.buckets)
    expect(h.sum_seconds).toBe(STUB_HISTOGRAM.sum_seconds)
    expect(h.observation_count).toBe(STUB_HISTOGRAM.observation_count)
  })

  it("answers 502 when control returns 200 without the start histogram, never a zeroed 200", async () => {
    // A 200 whose body carries no line of the canon family (an intermediary's
    // HTML error page) is not the read surface's data: zero-filling it would
    // fabricate an avg-start-time of 0s in state="ok".
    await serve(() => ({
      status: 200,
      body: "<html><body>login required</body></html>",
    }))

    const res = await GET()

    expect(res.status).toBe(502)
  })

  it("issues GET /metrics over the control socket", async () => {
    let seenPath = ""
    await serve((path) => {
      seenPath = path
      return { status: 200, body: STUB_EXPOSITION }
    })

    await GET()

    expect(seenPath).toBe("/metrics")
  })

  it("maps a control 503 to a 503 response, never a 2xx fallback", async () => {
    await serve(() => ({ status: 503, body: "" }))

    const res = await GET()

    expect(res.status).toBe(503)
  })

  it("returns 503 when no socket exists at the configured path", async () => {
    // No server is started: socketPath points into the temp dir where nothing
    // listens. A fail-open route would still answer 2xx with the fixture
    // histogram.
    const res = await GET()

    expect(res.status).toBe(503)
  })
})
