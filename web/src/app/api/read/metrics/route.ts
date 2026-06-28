// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// Mock BFF: GET /api/read/metrics — emits the fixture reserved->active
// start-duration histogram as a Prometheus text exposition. The client's
// Prometheus parser reads it back to the same StartHistogram (the round-trip
// the route test pins), so the average start time is derived from this
// histogram (sum / count), never from a row's active_at - reserved_at.
// Read-only all-GET leaf; imports no control-plane authority.

import { fixtureStartHistogram } from "@/lib/read/fixture"
import { serializePrometheusHistogram } from "@/lib/read/prometheus"

export async function GET(): Promise<Response> {
  const text = serializePrometheusHistogram(fixtureStartHistogram)
  return new Response(text, {
    status: 200,
    headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8" },
  })
}
