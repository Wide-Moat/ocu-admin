// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect } from "vitest"
import {
  activeCount,
  ageSeconds,
  avgStartSeconds,
  formatAge,
  stateLabel,
} from "../derive"
import { fixtureSessions, fixtureStartHistogram } from "../fixture"
import type { SessionView, StartHistogram } from "../types"

// All derive helpers are PURE: no Date.now() inside. The caller passes the
// clock (a `now: Date`), so every case below is deterministic.

describe("stateLabel — wire state → UI label (design-spec §3)", () => {
  it("maps reserved → Creating", () => {
    expect(stateLabel("reserved")).toBe("Creating")
  })

  it("maps active → Live", () => {
    expect(stateLabel("active")).toBe("Live")
  })

  it("maps released → Destroyed", () => {
    expect(stateLabel("released")).toBe("Destroyed")
  })

  it("maps every fixture row to a non-empty label", () => {
    for (const s of fixtureSessions) {
      const label = stateLabel(s.state)
      expect(["Creating", "Live", "Destroyed"]).toContain(label)
    }
  })
})

describe("ageSeconds — now − reserved_at, floored (design-spec §3 'Age')", () => {
  it("returns whole seconds for an exact difference", () => {
    const reserved = "2026-06-27T06:00:00.000Z"
    const now = new Date("2026-06-27T06:05:00.000Z") // +300s
    expect(ageSeconds(reserved, now)).toBe(300)
  })

  it("floors a fractional second difference", () => {
    const reserved = "2026-06-27T06:00:00.000Z"
    const now = new Date("2026-06-27T06:00:04.900Z") // +4.9s
    expect(ageSeconds(reserved, now)).toBe(4)
  })

  it("is zero at the instant of reservation", () => {
    const reserved = "2026-06-27T06:00:00.000Z"
    const now = new Date("2026-06-27T06:00:00.000Z")
    expect(ageSeconds(reserved, now)).toBe(0)
  })

  it("measures from reserved_at, not active_at", () => {
    // The fixture's first Live row: reserved 06:45:02, active 06:45:09.
    // Age at 06:46:02 is 60s from RESERVED, not 53s from active.
    const live = fixtureSessions.find((s) => s.session_key === "sess-2b81d4")!
    const now = new Date("2026-06-27T06:46:02.000Z")
    expect(ageSeconds(live.reserved_at, now)).toBe(60)
  })
})

describe("formatAge — compact age chip label", () => {
  it("renders sub-minute as bare seconds", () => {
    expect(formatAge(0)).toBe("0s")
    expect(formatAge(7)).toBe("7s")
    expect(formatAge(59)).toBe("59s")
  })

  it("renders the 60s boundary as 1m 00s", () => {
    expect(formatAge(60)).toBe("1m 00s")
  })

  it("zero-pads the seconds within a minute", () => {
    expect(formatAge(61)).toBe("1m 01s")
    expect(formatAge(252)).toBe("4m 12s")
    expect(formatAge(3599)).toBe("59m 59s")
  })

  it("renders the 1h boundary as 1h 00m", () => {
    expect(formatAge(3600)).toBe("1h 00m")
  })

  it("zero-pads the minutes within an hour and drops seconds", () => {
    expect(formatAge(3661)).toBe("1h 01m") // 1h 1m 1s → seconds dropped at hour scale
    expect(formatAge(7200)).toBe("2h 00m")
    expect(formatAge(45296)).toBe("12h 34m")
  })
})

describe("activeCount — count of state==='active' (Active sessions tile)", () => {
  it("counts the active rows in the fixture", () => {
    // The fixture has exactly two active rows.
    expect(activeCount(fixtureSessions)).toBe(2)
  })

  it("is 0 on an empty list", () => {
    expect(activeCount([])).toBe(0)
  })

  it("ignores reserved and released rows", () => {
    const rows: SessionView[] = [
      {
        session_key: "a",
        owner: { tenant: "t", caller: "c" },
        state: "reserved",
        reserved_at: "2026-06-27T06:00:00.000Z",
      },
      {
        session_key: "b",
        owner: { tenant: "t", caller: "c" },
        state: "released",
        reserved_at: "2026-06-27T06:00:00.000Z",
      },
    ]
    expect(activeCount(rows)).toBe(0)
  })

  it("counts only active among a mixed hand-built list", () => {
    const mk = (state: SessionView["state"]): SessionView => ({
      session_key: state,
      owner: { tenant: "t", caller: "c" },
      state,
      reserved_at: "2026-06-27T06:00:00.000Z",
    })
    const rows = [mk("active"), mk("active"), mk("active"), mk("reserved")]
    expect(activeCount(rows)).toBe(3)
  })
})

describe("avgStartSeconds — sum_seconds / observation_count (Avg start tile)", () => {
  it("derives the average from the histogram sum and count", () => {
    // The fixture: 78s over 12 observations → 6.5s.
    expect(avgStartSeconds(fixtureStartHistogram)).toBe(6.5)
  })

  it("computes a clean whole-second average", () => {
    const h: StartHistogram = {
      buckets: [{ le: 10, cumulative_count: 4 }],
      sum_seconds: 20,
      observation_count: 4,
    }
    expect(avgStartSeconds(h)).toBe(5)
  })

  it("guards observation_count === 0 by returning 0 (no division by zero)", () => {
    const empty: StartHistogram = {
      buckets: [],
      sum_seconds: 0,
      observation_count: 0,
    }
    expect(avgStartSeconds(empty)).toBe(0)
  })

  it("never derives from a single row's active_at − reserved_at", () => {
    // A row whose own active−reserved is 7s, but the histogram average is 6.5s.
    // The function must use ONLY the histogram (design-spec §3 forbids per-row).
    const live = fixtureSessions.find((s) => s.session_key === "sess-2b81d4")!
    const perRow =
      (Date.parse(live.active_at!) - Date.parse(live.reserved_at)) / 1000
    expect(perRow).toBe(7) // sanity: the row really is 7s
    expect(avgStartSeconds(fixtureStartHistogram)).toBe(6.5) // not 7
  })
})
