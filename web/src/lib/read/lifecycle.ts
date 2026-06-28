// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// Deterministic lifecycle simulation for the mock read surface. So the
// fixture-backed console shows motion rather than a frozen snapshot, the mock
// advances the seeded `reserved` row across reserved -> active -> released on a
// fixed schedule. It is pure and deterministic: `projectSessionsAt` takes the
// elapsed time (ms since the mock's epoch) as an argument, exactly as derive.ts
// injects `now` — it never reads the wall clock, so a test pins the elapsed ms
// and gets a stable projection.
//
// The simulation respects the ADR-0022 absent-until-active invariant: the
// animated row carries no caps / active_at / container_name while reserved, and
// gains them only when it crosses into active. A released row becomes a
// tombstone surfaced only when includeReleased is set. The already-active and
// already-released seed rows are passed through unchanged — they remain honest
// examples of each enriched state.

import { fixtureSessions } from "./fixture"
import type { SessionView } from "./types"

/** How long the animated row sits in `reserved` before crossing to `active`. */
export const RESERVED_TO_ACTIVE_MS = 6_000

/** How long it then stays `active` before becoming a released tombstone. */
export const ACTIVE_TO_RELEASED_MS = 30_000

// Enrichment the animated row gains the moment it crosses into `active`. The
// values mirror a realistic active row; they are invented here, but only the
// contract fields (caps / container_name / active_at) are ever set.
const ANIMATED_CAPS = {
  cpu_cores: 1.0,
  memory_bytes: 2 * 1024 * 1024 * 1024, // 2 GiB
  pids_limit: 256,
}

/**
 * Project the seeded sessions at `elapsedMs` since the mock epoch. The seeded
 * `reserved` row advances reserved -> active -> released by the fixed schedule;
 * all other seed rows pass through unchanged. With `includeReleased: false`,
 * released rows (animated tombstone and the seeded released row) are dropped.
 */
export function projectSessionsAt(
  elapsedMs: number,
  opts: { includeReleased: boolean },
): SessionView[] {
  const projected = fixtureSessions.map((row) =>
    row.state === "reserved" ? advanceReservedRow(row, elapsedMs) : row,
  )
  if (opts.includeReleased) {
    return projected
  }
  return projected.filter((s) => s.state !== "released")
}

// Advance a seeded reserved row to its state at `elapsedMs`. Before the active
// edge it stays reserved (no enrichment); after it, it is active with caps,
// container_name, and an active_at derived from reserved_at + the edge; past the
// released edge it is a released tombstone keeping its historical timestamps.
function advanceReservedRow(row: SessionView, elapsedMs: number): SessionView {
  if (elapsedMs < RESERVED_TO_ACTIVE_MS) {
    // Still reserved: only the always-present fields, no enrichment.
    return row
  }

  const reservedMs = Date.parse(row.reserved_at)
  const activeAt = new Date(reservedMs + RESERVED_TO_ACTIVE_MS).toISOString()
  const enriched: SessionView = {
    ...row,
    state: "active",
    container_name: `ocu-sb-${row.key.replace(/^sess-/, "")}`,
    caps: { ...ANIMATED_CAPS },
    active_at: activeAt,
  }

  if (elapsedMs < RESERVED_TO_ACTIVE_MS + ACTIVE_TO_RELEASED_MS) {
    return enriched
  }

  // Past the released edge: a tombstone keeping its historical timestamps.
  return { ...enriched, state: "released" }
}
