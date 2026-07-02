// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// BFF: GET /api/read/metrics — proxies the control operator socket's
// GET /metrics and re-emits the reserved->active start-duration histogram as a
// Prometheus text exposition. Control's text is parsed to a typed
// StartHistogram and re-serialized, so the route normalizes the exposition to
// exactly the histogram the dashboard reads: the average start time is derived
// from this histogram (sum / count), never from a row's active_at -
// reserved_at. Read-only all-GET leaf; imports no control-plane authority.
//
// The client is built inside the handler so the socket path env is read per
// request, not at module load. Failure is never masked: a control non-2xx
// surfaces as its own status, and a transport failure (no socket, refused
// connection) surfaces as 503 — there is no fixture or default fallback.

import { createControlReadClient } from "@/lib/read/control-client"
import { ReadUnavailableError } from "@/lib/read/client"
import { serializePrometheusHistogram } from "@/lib/read/prometheus"

export async function GET(): Promise<Response> {
  try {
    const client = createControlReadClient()
    const histogram = await client.getMetrics()
    const text = serializePrometheusHistogram(histogram)
    return new Response(text, {
      status: 200,
      headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8" },
    })
  } catch (err) {
    if (err instanceof ReadUnavailableError) {
      return new Response(null, { status: err.status })
    }
    return new Response(null, { status: 503 })
  }
}
