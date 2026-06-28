// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect } from "vitest"
import {
  projectSessionsAt,
  RESERVED_TO_ACTIVE_MS,
  ACTIVE_TO_RELEASED_MS,
} from "../lifecycle"
import { fixtureSessions } from "../fixture"

// The mock advances a session reserved -> active -> released on a timer, so the
// fixture-backed console shows an evolving lifecycle rather than a frozen
// snapshot. It is deterministic: `projectSessionsAt` takes the elapsed
// wall-time (a number of ms since a fixed epoch), exactly as derive.ts injects
// `now` — no real clock, no Date.now() inside. caps/active_at/container_name
// appear only once a row crosses into active; a released row becomes a
// tombstone surfaced only with includeReleased.

// A row that begins reserved, on a known reserved_at, so we can drive it across
// both lifecycle edges by elapsed ms.
function reservedRow() {
  return fixtureSessions.find((s) => s.state === "reserved")!
}

describe("projectSessionsAt — deterministic lifecycle simulation", () => {
  it("at t=0 a reserved row is still reserved with no enrichment", () => {
    const rows = projectSessionsAt(0, { includeReleased: true })
    const r = rows.find((s) => s.key === reservedRow().key)!
    expect(r.state).toBe("reserved")
    expect(r.caps).toBeUndefined()
    expect(r.active_at).toBeUndefined()
    expect(r.container_name).toBeUndefined()
  })

  it("after RESERVED_TO_ACTIVE_MS the reserved row becomes active and gains enrichment", () => {
    const rows = projectSessionsAt(RESERVED_TO_ACTIVE_MS + 1, {
      includeReleased: true,
    })
    const r = rows.find((s) => s.key === reservedRow().key)!
    expect(r.state).toBe("active")
    expect(r.caps).toBeDefined()
    expect(typeof r.active_at).toBe("string")
    expect(typeof r.container_name).toBe("string")
  })

  it("after ACTIVE_TO_RELEASED_MS the row becomes a released tombstone", () => {
    const elapsed = RESERVED_TO_ACTIVE_MS + ACTIVE_TO_RELEASED_MS + 1
    const rows = projectSessionsAt(elapsed, { includeReleased: true })
    const r = rows.find((s) => s.key === reservedRow().key)!
    expect(r.state).toBe("released")
  })

  it("released rows are hidden unless includeReleased is set", () => {
    const elapsed = RESERVED_TO_ACTIVE_MS + ACTIVE_TO_RELEASED_MS + 1
    const withTombstones = projectSessionsAt(elapsed, {
      includeReleased: true,
    })
    const liveOnly = projectSessionsAt(elapsed, { includeReleased: false })
    expect(withTombstones.some((s) => s.state === "released")).toBe(true)
    expect(liveOnly.every((s) => s.state !== "released")).toBe(true)
  })

  it("every projected row still satisfies the absent-until-active invariant", () => {
    // Sweep several points in time; a reserved row never carries enrichment.
    for (const t of [0, RESERVED_TO_ACTIVE_MS - 1, RESERVED_TO_ACTIVE_MS + 1]) {
      const rows = projectSessionsAt(t, { includeReleased: true })
      for (const s of rows) {
        if (s.state === "reserved") {
          expect(s.caps).toBeUndefined()
          expect(s.active_at).toBeUndefined()
          expect(s.container_name).toBeUndefined()
        }
      }
    }
  })

  it("is deterministic: the same elapsed time yields the same projection", () => {
    const a = projectSessionsAt(RESERVED_TO_ACTIVE_MS + 5, {
      includeReleased: true,
    })
    const b = projectSessionsAt(RESERVED_TO_ACTIVE_MS + 5, {
      includeReleased: true,
    })
    expect(a).toEqual(b)
  })
})
