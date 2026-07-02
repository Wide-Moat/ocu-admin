// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// Serialize a StartHistogram into a Prometheus exposition — the inverse of the
// client's parsePrometheusHistogram. The metrics BFF route uses it to re-emit
// the histogram it read from control as real Prometheus text, which the client
// parser reads back to the same histogram (a round-trip the route test pins).
// A terminal `+Inf` bucket is emitted (its count equals _count), as Prometheus
// requires, and dropped again on parse.

import type { StartHistogram } from "./types"

/**
 * The canonical metric family for reserved->active start duration — the single
 * source of truth for the name. The serializer emits it and the read client's
 * parser anchors on it, so both sides always speak about the same family.
 */
export const START_HISTOGRAM_METRIC = "ocu_session_start_seconds"

/**
 * Render `h` as a Prometheus histogram exposition: a HELP/TYPE header, the
 * cumulative `_bucket{le="..."}` lines (finite bounds plus the terminal
 * `+Inf`), the `_sum`, and the `_count`. The `+Inf` bucket count equals
 * `observation_count`, satisfying Prometheus's terminal-bucket rule.
 */
export function serializePrometheusHistogram(h: StartHistogram): string {
  const metric = START_HISTOGRAM_METRIC
  const lines: string[] = [
    `# HELP ${metric} reserved->active start duration in seconds`,
    `# TYPE ${metric} histogram`,
  ]
  for (const b of h.buckets) {
    lines.push(`${metric}_bucket{le="${formatLe(b.le)}"} ${b.cumulative_count}`)
  }
  lines.push(`${metric}_bucket{le="+Inf"} ${h.observation_count}`)
  lines.push(`${metric}_sum ${h.sum_seconds}`)
  lines.push(`${metric}_count ${h.observation_count}`)
  return lines.join("\n") + "\n"
}

// Render a bucket bound the way Prometheus does: an integer-valued bound keeps a
// trailing `.0` so it reads as a float bound, matching common client output.
function formatLe(le: number): string {
  return Number.isInteger(le) ? `${le}.0` : String(le)
}
