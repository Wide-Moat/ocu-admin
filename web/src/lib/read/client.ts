// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// The read client: the seam the dashboard depends on to reach the operator
// read surface. It is a read-only leaf — it issues only GETs, holds no mutating
// path, and imports no control-plane authority (the import-boundary rule pins
// `src/lib/read` away from `src/lib/authority`). The four methods mirror the
// ratified ADR-0022 read API one-to-one:
//
//   listSessions  -> GET /v1alpha/sessions            (?include_released)
//   getSession    -> GET /v1alpha/sessions/{key}      (null on 404)
//   getDeployment -> GET /v1alpha/deployment
//   getMetrics    -> GET /metrics                     (Prometheus text)
//
// On any non-2xx other than getSession's 404, a method throws
// ReadUnavailableError carrying the HTTP status — the 503 / BoundedReason path
// the Dashboard renders as state="unavailable". getMetrics additionally throws
// a 502 ReadUnavailableError when a 2xx body holds no line of the start
// histogram family: the endpoint answered, but not with the read surface's
// data, and zero-filling it would fabricate a tile. The contract types
// (SessionView, DeploymentView, StartHistogram) are the read types; this client
// invents no field beyond them.

import { START_HISTOGRAM_METRIC } from "./prometheus"
import type { DeploymentView, SessionView, StartHistogram } from "./types"

/**
 * The read seam. page.tsx depends on this interface, not a concrete client, so
 * the mock BFF and a future real BFF are interchangeable. Every method is
 * async and read-only; none mutates control-plane state. `includeReleased` on
 * listSessions adds the `?include_released` query param, surfacing released
 * tombstones; absent/false, the list is live rows only.
 */
export type ReadClient = {
  listSessions(opts?: { includeReleased?: boolean }): Promise<SessionView[]>
  getSession(key: string): Promise<SessionView | null>
  getDeployment(): Promise<DeploymentView>
  getMetrics(): Promise<StartHistogram>
}

/**
 * The read surface is unreachable, refused the read (a non-2xx), or answered
 * without the read surface's data (getMetrics's absent-family 502). It carries
 * the HTTP `status` so the page can map a 503 / BoundedReason envelope to the
 * Dashboard's state="unavailable" surface without inspecting a response body.
 */
export class ReadUnavailableError extends Error {
  readonly status: number

  constructor(status: number, endpoint: string) {
    super(`read surface unavailable: ${status} from ${endpoint}`)
    this.name = "ReadUnavailableError"
    this.status = status
  }
}

// The only outward dependency a client takes: a `fetch`. It defaults to the
// global, and tests inject a stub so no real network is touched.
export type ReadClientDeps = {
  fetch?: typeof fetch
}

/**
 * Build an HTTP ReadClient for a BFF mounted at `baseUrl`. `deps.fetch`
 * defaults to the global fetch; tests pass a stub.
 */
export function createHttpReadClient(
  baseUrl: string,
  deps: ReadClientDeps = {},
): ReadClient {
  const doFetch = deps.fetch ?? fetch
  const base = baseUrl.replace(/\/+$/, "")

  async function getOk(path: string): Promise<Response> {
    const res = await doFetch(`${base}${path}`)
    if (!res.ok) {
      throw new ReadUnavailableError(res.status, path)
    }
    return res
  }

  return {
    async listSessions(opts?: {
      includeReleased?: boolean
    }): Promise<SessionView[]> {
      const query = opts?.includeReleased ? "?include_released=true" : ""
      const res = await getOk(`/v1alpha/sessions${query}`)
      return (await res.json()) as SessionView[]
    },

    async getSession(key: string): Promise<SessionView | null> {
      const path = `/v1alpha/sessions/${encodeURIComponent(key)}`
      const res = await doFetch(`${base}${path}`)
      if (res.status === 404) {
        return null
      }
      if (!res.ok) {
        throw new ReadUnavailableError(res.status, path)
      }
      return (await res.json()) as SessionView
    },

    async getDeployment(): Promise<DeploymentView> {
      const res = await getOk("/v1alpha/deployment")
      return (await res.json()) as DeploymentView
    },

    async getMetrics(): Promise<StartHistogram> {
      const res = await getOk("/metrics")
      const text = await res.text()
      // A 2xx whose body holds no line of the start-histogram family (an
      // empty body, an intermediary's HTML error page) is not the read
      // surface's data: zero-filling it would fabricate an avg-start-time
      // tile in state="ok". The endpoint answered, but not with the read —
      // surface it as a 502 unavailable read. A family that IS present with
      // zero observations parses to an honest zeroed histogram instead.
      if (!hasHistogramFamily(text, START_HISTOGRAM_METRIC)) {
        throw new ReadUnavailableError(502, "/metrics")
      }
      return parsePrometheusHistogram(text, START_HISTOGRAM_METRIC)
    },
  }
}

// Escape a metric name for literal use inside a RegExp.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// The three sample-line shapes of one histogram family, anchored to its name:
// `<metric>_bucket{le="<bound>"} <count>` (`<bound>` a number or `+Inf`),
// `<metric>_sum <seconds>`, and `<metric>_count <count>`. The `^` anchor plus
// the fixed suffix means lines of any other family never match.
function familyRegexes(metric: string): {
  bucketRe: RegExp
  sumRe: RegExp
  countRe: RegExp
} {
  const name = escapeRegExp(metric)
  return {
    bucketRe: new RegExp(
      `^${name}_bucket\\{[^}]*\\ble="([^"]+)"[^}]*\\}\\s+([0-9.eE+-]+)\\s*$`,
    ),
    sumRe: new RegExp(`^${name}_sum\\s+([0-9.eE+-]+)\\s*$`),
    countRe: new RegExp(`^${name}_count\\s+([0-9.eE+-]+)\\s*$`),
  }
}

// True when at least one sample line of `metric` (a bucket, the sum, or the
// count) is present in the exposition — the "family absent" test getMetrics
// uses to refuse a body that is not the read surface's data. HELP/TYPE
// comments alone do not count: a family with no samples reports nothing.
function hasHistogramFamily(text: string, metric: string): boolean {
  const { bucketRe, sumRe, countRe } = familyRegexes(metric)
  return text.split("\n").some((rawLine) => {
    const line = rawLine.trim()
    return bucketRe.test(line) || sumRe.test(line) || countRe.test(line)
  })
}

/**
 * Parse the `metric` histogram family out of a Prometheus exposition. The
 * parser is anchored to the family name: only `<metric>_bucket{le="..."}`
 * lines (ascending, cumulative), the `<metric>_sum` (total observed seconds),
 * and the `<metric>_count` (observation count) are read — every other metric
 * family, and all comment lines (`#`), are ignored, so a real exposition
 * carrying process_/go_/http_ families cannot bleed into the result. The
 * `+Inf` bucket is dropped — its count duplicates `_count`, and the view types
 * model only the finite buckets.
 *
 * Parse-only: an exposition holding no line of the family yields a zeroed
 * histogram, indistinguishable here from a present family with zero
 * observations. The caller owns that distinction — getMetrics refuses an
 * absent family with a 502 ReadUnavailableError rather than serving the
 * zeroed parse as data.
 */
export function parsePrometheusHistogram(
  text: string,
  metric: string,
): StartHistogram {
  const { bucketRe, sumRe, countRe } = familyRegexes(metric)
  const buckets: { le: number; cumulative_count: number }[] = []
  let sum_seconds = 0
  let observation_count = 0

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim()
    if (line.length === 0 || line.startsWith("#")) {
      continue
    }

    const bucket = bucketRe.exec(line)
    if (bucket) {
      const le = Number(bucket[1])
      // Drop the +Inf catch-all bucket; the view models only finite bounds.
      if (Number.isFinite(le)) {
        buckets.push({ le, cumulative_count: Number(bucket[2]) })
      }
      continue
    }

    const sum = sumRe.exec(line)
    if (sum) {
      sum_seconds = Number(sum[1])
      continue
    }

    const count = countRe.exec(line)
    if (count) {
      observation_count = Number(count[1])
    }
  }

  buckets.sort((a, b) => a.le - b.le)
  return { buckets, sum_seconds, observation_count }
}
