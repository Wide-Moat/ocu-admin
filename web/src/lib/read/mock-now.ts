// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// The mock's clock seam. The lifecycle simulation is driven by elapsed ms since
// a fixed epoch (the seeded reserved row's reserved_at). At request time the
// shipped route handlers compute that elapsed value from the wall clock; this
// helper is the single place the wall clock is read, so the lifecycle module
// itself stays pure (it takes elapsed ms as an argument, exactly as derive.ts
// injects `now`).

import { fixtureSessions } from "./fixture"

// The mock epoch: the reserved row's reserved_at. Elapsed time is measured from
// here so the seeded reserved row animates relative to its own start instant.
const MOCK_EPOCH_MS = Date.parse(
  fixtureSessions.find((s) => s.state === "reserved")!.reserved_at,
)

/**
 * Elapsed ms since the mock epoch at `now` (defaults to the wall clock). The
 * default makes the route handler animate live; tests of the pure lifecycle
 * pass an explicit elapsed value to `projectSessionsAt` instead and never reach
 * here.
 */
export function elapsedSinceEpoch(now: Date = new Date()): number {
  return now.getTime() - MOCK_EPOCH_MS
}
