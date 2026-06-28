// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect, expectTypeOf } from "vitest"
import { fixtureSessions } from "../fixture"
import type { SessionCaps, SessionView } from "../types"

// The CONSTITUTION §6 shape-contract guard. ADR-0022 is status:accepted on
// next/v1, so the read row is now frozen: this test pins the UI row type to the
// ratified field set and its optionality, and reds if a field is invented, an
// enrichment field is made non-optional, or a fixture row carries an extra key.
// It is the guard §6 named as a TODO; it bites both at the type level
// (expectTypeOf, checked by tsc) and at runtime (Object.keys over the fixture).

// The ratified ADR-0022 read-row field set. Required: key, owner, state,
// reserved_at. Optional (activation enrichment): container_name, caps,
// active_at. Any key outside this set on a fixture row is an invented field.
const CONTRACT_ROW_KEYS = new Set([
  "key",
  "owner",
  "state",
  "container_name",
  "caps",
  "reserved_at",
  "active_at",
])

const CONTRACT_OWNER_KEYS = new Set(["tenant", "caller"])

const CONTRACT_CAPS_KEYS = new Set(["cpu_cores", "memory_bytes", "pids_limit"])

describe("ADR-0022 read-row shape contract (CONSTITUTION §6)", () => {
  it("the row's required fields are exactly {key, owner{tenant,caller}, state, reserved_at}", () => {
    // Type-level: a row with only the four always-present fields satisfies the
    // contract — none of them is optional, all four are required.
    const minimal = {
      key: "sess-0000",
      owner: { tenant: "t", caller: "c" },
      state: "reserved",
      reserved_at: "2026-06-27T00:00:00.000Z",
    } satisfies SessionView
    expect(minimal.key).toBe("sess-0000")

    // Dropping any one of the four must fail the `satisfies SessionView` check;
    // expressed positively here, the four required keys are all present.
    expectTypeOf<SessionView["key"]>().toEqualTypeOf<string>()
    expectTypeOf<SessionView["owner"]>().toEqualTypeOf<{
      tenant: string
      caller: string
    }>()
    expectTypeOf<SessionView["reserved_at"]>().toEqualTypeOf<string>()
  })

  it("container_name, caps, and active_at are optional enrichment (absent until active)", () => {
    expectTypeOf<SessionView["container_name"]>().toEqualTypeOf<
      string | undefined
    >()
    expectTypeOf<SessionView["caps"]>().toEqualTypeOf<SessionCaps | undefined>()
    expectTypeOf<SessionView["active_at"]>().toEqualTypeOf<string | undefined>()
  })

  it("caps has exactly {cpu_cores, memory_bytes, pids_limit?}", () => {
    expectTypeOf<SessionCaps["cpu_cores"]>().toEqualTypeOf<number>()
    expectTypeOf<SessionCaps["memory_bytes"]>().toEqualTypeOf<number>()
    expectTypeOf<SessionCaps["pids_limit"]>().toEqualTypeOf<
      number | undefined
    >()
    // Runtime: caps on every enriched fixture row carries no invented key.
    for (const s of fixtureSessions) {
      if (s.caps === undefined) {
        continue
      }
      for (const k of Object.keys(s.caps)) {
        expect(CONTRACT_CAPS_KEYS.has(k)).toBe(true)
      }
    }
  })

  it("no fixture row carries a field outside the contract set (Object.keys ⊆ contract)", () => {
    for (const s of fixtureSessions) {
      for (const k of Object.keys(s)) {
        // An invented key here (a row with a field the contract does not emit)
        // reds this assertion — that is what makes the guard bite.
        expect(CONTRACT_ROW_KEYS.has(k)).toBe(true)
      }
      for (const k of Object.keys(s.owner)) {
        expect(CONTRACT_OWNER_KEYS.has(k)).toBe(true)
      }
    }
  })

  it("reserved_at is present on every row; enrichment is absent unless state===active", () => {
    for (const s of fixtureSessions) {
      expect(s.reserved_at).toBeDefined()
      if (s.state === "reserved") {
        // reserved rows carry only the always-present fields.
        expect(s.caps).toBeUndefined()
        expect(s.container_name).toBeUndefined()
        expect(s.active_at).toBeUndefined()
      }
    }
  })
})
