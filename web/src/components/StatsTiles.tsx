// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// StatsTiles — the dashboard's two summary stats (design-spec §4, "Stats tiles
// (exactly two, per canon)"). EXACTLY TWO tiles, never more:
//
//   - Active sessions = activeCount(sessions): the count of rows whose
//     state === "active" (Live). 0 on an empty list.
//   - Avg start time  = avgStartSeconds(histogram): the mean reserved→active
//     duration parsed from the /metrics histogram — NEVER `active_at −
//     reserved_at` of a row (§3, "derived values, never from a row"). The value
//     is read from the histogram prop, so a row's active_at cannot move it.
//
// It is a presentational read-only-leaf component: sessions + histogram are
// props, it fetches nothing. It imports only the read zone (`@/lib/read`) and
// React; the import-boundary rule pins that it cannot reach a control-plane
// authority. NOC styling matches SessionCard (zinc surfaces, hairline borders).

import type { ReactElement } from "react"

import { activeCount, avgStartSeconds } from "@/lib/read/derive"
import type { SessionView, StartHistogram } from "@/lib/read/types"

/**
 * Format an average start time in seconds as a compact "6.5s" figure — one
 * decimal so a sub-second-resolution mean (e.g. 6.5s) is not flattened to a
 * whole second the way `formatAge` would. Distinct from the card's age chip,
 * which is a whole-second duration; this is a derived mean from the histogram.
 */
function formatStartSeconds(seconds: number): string {
  return `${seconds.toFixed(1)}s`
}

/**
 * One NOC stat tile: a muted zinc surface with a small uppercase label over a
 * large value. The wrapper carries both `data-testid="stat-tile"` (so the
 * dashboard can assert "exactly two") and a per-tile id (`stat-active` /
 * `stat-avg-start`) that scopes its label + value as descendants.
 */
function StatTile({
  label,
  value,
  tileTestid,
  valueTestid,
}: {
  label: string
  value: string
  tileTestid: string
  valueTestid: string
}): ReactElement {
  return (
    <div
      data-testid="stat-tile"
      data-tile={tileTestid}
      className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
    >
      {/* A second data-testid on the wrapper scopes within() queries to this
          tile (label + value are descendants). */}
      <div data-testid={tileTestid} className="contents">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </span>
        <span
          data-testid={valueTestid}
          className="font-mono text-2xl text-zinc-100 tabular-nums"
        >
          {value}
        </span>
      </div>
    </div>
  )
}

export function StatsTiles({
  sessions,
  histogram,
}: {
  sessions: SessionView[]
  histogram: StartHistogram
}): ReactElement {
  const active = activeCount(sessions)
  const avgStart = formatStartSeconds(avgStartSeconds(histogram))

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatTile
        label="Active sessions"
        value={String(active)}
        tileTestid="stat-active"
        valueTestid="stat-active-value"
      />
      <StatTile
        label="Avg start time"
        value={avgStart}
        tileTestid="stat-avg-start"
        valueTestid="stat-avg-start-value"
      />
    </div>
  )
}
