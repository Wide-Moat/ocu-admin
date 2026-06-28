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
// the Dashboard renders as state="unavailable". The contract types
// (SessionView, DeploymentView, StartHistogram) are the read types; this client
// invents no field beyond them.

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
 * The read surface is unreachable or refused the read (a non-2xx). It carries
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
      return parsePrometheusHistogram(await res.text())
    },
  }
}

// Matches a histogram bucket line: `<name>_bucket{le="<bound>"} <count>`.
// `<bound>` may be a number or `+Inf` (the terminal catch-all bucket).
const BUCKET_RE = /_bucket\{[^}]*\ble="([^"]+)"[^}]*\}\s+([0-9.eE+-]+)\s*$/
const SUM_RE = /_sum\s+([0-9.eE+-]+)\s*$/
const COUNT_RE = /_count\s+([0-9.eE+-]+)\s*$/

/**
 * Parse a Prometheus exposition into a StartHistogram. It reads the
 * `*_bucket{le="..."}` lines (ascending, cumulative), the `*_sum` (total
 * observed seconds), and the `*_count` (observation count). The `+Inf` bucket
 * is dropped — its count duplicates `_count`, and the view types model only the
 * finite buckets. Comment lines (`#`) and unrelated metrics are ignored. An
 * empty exposition yields a zeroed histogram (no buckets, sum 0, count 0), so
 * an empty `/metrics` does not throw.
 */
export function parsePrometheusHistogram(text: string): StartHistogram {
  const buckets: { le: number; cumulative_count: number }[] = []
  let sum_seconds = 0
  let observation_count = 0

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim()
    if (line.length === 0 || line.startsWith("#")) {
      continue
    }

    const bucket = BUCKET_RE.exec(line)
    if (bucket) {
      const le = Number(bucket[1])
      // Drop the +Inf catch-all bucket; the view models only finite bounds.
      if (Number.isFinite(le)) {
        buckets.push({ le, cumulative_count: Number(bucket[2]) })
      }
      continue
    }

    const sum = SUM_RE.exec(line)
    if (sum) {
      sum_seconds = Number(sum[1])
      continue
    }

    const count = COUNT_RE.exec(line)
    if (count) {
      observation_count = Number(count[1])
    }
  }

  buckets.sort((a, b) => a.le - b.le)
  return { buckets, sum_seconds, observation_count }
}
