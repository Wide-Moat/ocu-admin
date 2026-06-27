// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect } from "vitest"
import {
  fixtureDeployment,
  fixtureSessions,
  fixtureStartHistogram,
} from "../fixture"
import type { SessionState, SessionView } from "../types"

const ALLOWED_STATES: readonly SessionState[] = [
  "reserved",
  "active",
  "released",
]
const ALLOWED_TIERS = ["runc", "gvisor", "firecracker"] as const
const ALLOWED_PROVIDERS = ["docker", "k8s"] as const

const byState = (state: SessionState): SessionView[] =>
  fixtureSessions.filter((s) => s.state === state)

describe("fixture session lifecycle states", () => {
  it("every row's state is one of the three lowercase literals", () => {
    for (const s of fixtureSessions) {
      expect(ALLOWED_STATES).toContain(s.state)
    }
  })

  it("contains at least one row of each lifecycle state", () => {
    for (const state of ALLOWED_STATES) {
      expect(byState(state).length).toBeGreaterThanOrEqual(1)
    }
  })

  it("every row always carries session_key, owner, and reserved_at", () => {
    for (const s of fixtureSessions) {
      expect(typeof s.session_key).toBe("string")
      expect(s.session_key.length).toBeGreaterThan(0)
      expect(typeof s.owner.tenant).toBe("string")
      expect(typeof s.owner.caller).toBe("string")
      expect(typeof s.reserved_at).toBe("string")
      // reserved_at is a parseable ISO instant.
      expect(Number.isNaN(Date.parse(s.reserved_at))).toBe(false)
    }
  })
})

describe("reserved row — absent-until-active invariant", () => {
  it("has NO caps, container_name, or active_at", () => {
    const reserved = byState("reserved")
    expect(reserved.length).toBeGreaterThanOrEqual(1)
    for (const s of reserved) {
      expect(s.caps).toBeUndefined()
      expect(s.container_name).toBeUndefined()
      expect(s.active_at).toBeUndefined()
    }
  })
})

describe("active row — activation enrichment present", () => {
  it("has caps with integer memory_bytes/pids_limit, a container_name, and active_at", () => {
    const active = byState("active")
    expect(active.length).toBeGreaterThanOrEqual(1)
    for (const s of active) {
      expect(s.caps).toBeDefined()
      const caps = s.caps!
      // cpu_cores is fractional (a number, exclusiveMinimum 0).
      expect(typeof caps.cpu_cores).toBe("number")
      expect(caps.cpu_cores).toBeGreaterThan(0)
      // memory_bytes is an integer count of bytes.
      expect(Number.isInteger(caps.memory_bytes)).toBe(true)
      expect(caps.memory_bytes).toBeGreaterThan(0)
      // pids_limit, when present, is an integer process-count cap.
      expect(caps.pids_limit).toBeDefined()
      expect(Number.isInteger(caps.pids_limit!)).toBe(true)
      expect(caps.pids_limit!).toBeGreaterThan(0)

      expect(typeof s.container_name).toBe("string")
      expect(s.container_name!.length).toBeGreaterThan(0)

      expect(typeof s.active_at).toBe("string")
      expect(Number.isNaN(Date.parse(s.active_at!))).toBe(false)
    }
  })
})

describe("released row — tombstone", () => {
  it("is present and carries the released state", () => {
    const released = byState("released")
    expect(released.length).toBeGreaterThanOrEqual(1)
    for (const s of released) {
      expect(s.state).toBe("released")
    }
  })
})

describe("fixture deployment singleton", () => {
  it("tier and provider are from the allowed enums", () => {
    expect(ALLOWED_TIERS).toContain(fixtureDeployment.runtime_tier)
    expect(ALLOWED_PROVIDERS).toContain(fixtureDeployment.runtime_provider)
  })
})

describe("reserved→active start-time histogram fixture", () => {
  it("is a non-empty set of cumulative buckets plus sum and count", () => {
    expect(fixtureStartHistogram.buckets.length).toBeGreaterThan(0)
    // Buckets are cumulative: le ascending, cumulative_count non-decreasing.
    let prevLe = -Infinity
    let prevCount = -1
    for (const b of fixtureStartHistogram.buckets) {
      expect(typeof b.le).toBe("number")
      expect(b.le).toBeGreaterThan(prevLe)
      expect(Number.isInteger(b.cumulative_count)).toBe(true)
      expect(b.cumulative_count).toBeGreaterThanOrEqual(prevCount)
      prevLe = b.le
      prevCount = b.cumulative_count
    }
    expect(fixtureStartHistogram.sum_seconds).toBeGreaterThan(0)
    expect(Number.isInteger(fixtureStartHistogram.observation_count)).toBe(true)
    expect(fixtureStartHistogram.observation_count).toBeGreaterThan(0)
    // The terminal cumulative bucket accounts for every observation.
    const last =
      fixtureStartHistogram.buckets[fixtureStartHistogram.buckets.length - 1]
    expect(last.cumulative_count).toBe(fixtureStartHistogram.observation_count)
  })

  it("supports deriving a finite positive average (sum / count)", () => {
    const avg =
      fixtureStartHistogram.sum_seconds /
      fixtureStartHistogram.observation_count
    expect(Number.isFinite(avg)).toBe(true)
    expect(avg).toBeGreaterThan(0)
  })
})
