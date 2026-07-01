// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// Pure view-derivation helpers for the ocu-admin operator console.
//
// Every function here is pure and deterministic: it reads only its arguments and
// the read-surface view types — never a control-plane authority, never the wall
// clock. The clock is a `now: Date` parameter the caller passes, so the card's
// age renders the same in a test and at runtime. This file is part of the
// read-only leaf; it imports only the read view types (the import-boundary rule
// pins that it cannot reach `src/lib/authority`).

import type { SessionState, SessionView, StartHistogram } from "./types"

/**
 * The UI label for a wire lifecycle state (design-spec §3, "State → UI label
 * mapping"). The wire keeps the lowercase canon literals; only the view layer
 * speaks "Creating" / "Live" / "Destroyed".
 *
 * The `default` branch assigns `state` to a `never`, so adding a fourth
 * `SessionState` member becomes a compile error here until this mapping is
 * extended — the exhaustiveness is enforced by `tsc`, not by a runtime guess.
 */
export function stateLabel(
  state: SessionState,
): "Creating" | "Live" | "Destroyed" {
  switch (state) {
    case "reserved":
      return "Creating"
    case "active":
      return "Live"
    case "released":
      return "Destroyed"
    default: {
      const exhaustive: never = state
      return exhaustive
    }
  }
}

/**
 * Age of a session in whole seconds: `now − reserved_at` (design-spec §3,
 * "Age = now − reserved_at … how long it has existed, not start time"). Measured
 * from `reserved_at`, never `active_at`. Fractional seconds are floored.
 */
export function ageSeconds(reserved_at: string, now: Date): number {
  const elapsedMs = now.getTime() - Date.parse(reserved_at)
  // Clamp at 0: clock skew between the BFF and the control plane can leave
  // reserved_at slightly ahead of `now`, and a card must never show a negative
  // age (e.g. "-3s").
  return Math.max(0, Math.floor(elapsedMs / 1000))
}

/**
 * Compact age-chip label for a session card. Three scales:
 * - under a minute: bare seconds (`"42s"`);
 * - under an hour: minutes + zero-padded seconds (`"4m 12s"`);
 * - an hour or more: hours + zero-padded minutes, seconds dropped (`"1h 03m"`).
 */
export function formatAge(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const rem = seconds % 60
    return `${minutes}m ${pad2(rem)}s`
  }
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${pad2(minutes)}m`
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0")
}

/**
 * Count of sessions in the `active` (Live) state — the "Active sessions" stat
 * tile (design-spec §4). 0 on an empty list.
 */
export function activeCount(sessions: SessionView[]): number {
  return sessions.filter((s) => s.state === "active").length
}

/**
 * Average reserved→active duration in seconds — the "Avg start time" stat tile.
 * Derived ONLY from the parsed `/metrics` histogram as `sum_seconds /
 * observation_count` (design-spec §3, "never from a row"); it never inspects an
 * individual session's `active_at − reserved_at`. When there are no observations
 * the average is undefined, so this returns 0 rather than dividing by zero.
 */
export function avgStartSeconds(h: StartHistogram): number {
  if (h.observation_count === 0) {
    return 0
  }
  return h.sum_seconds / h.observation_count
}
