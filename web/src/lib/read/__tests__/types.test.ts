// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect, expectTypeOf } from "vitest"
import type {
  DeploymentView,
  SessionCaps,
  SessionState,
  SessionView,
} from "../types"

// These assertions are compile-checked by `tsc --noEmit`; the runtime `it`
// bodies exist only so vitest reports them as executed cases. If the shape
// drifts from the drafted ADR-0022 contract, the type assertions stop compiling.

describe("read-surface view types", () => {
  it("SessionState is exactly the three lowercase canon literals", () => {
    expectTypeOf<SessionState>().toEqualTypeOf<
      "reserved" | "active" | "released"
    >()
  })

  it("a reserved row needs only the always-present fields", () => {
    // No caps / container_name / active_at — the type permits their absence.
    const reserved = {
      session_key: "sess-0000",
      owner: { tenant: "t", caller: "c" },
      state: "reserved",
      reserved_at: "2026-06-27T00:00:00.000Z",
    } satisfies SessionView
    expect(reserved.state).toBe("reserved")
  })

  it("caps carry fractional cpu_cores and integer byte/pid counts", () => {
    expectTypeOf<SessionCaps["cpu_cores"]>().toEqualTypeOf<number>()
    expectTypeOf<SessionCaps["memory_bytes"]>().toEqualTypeOf<number>()
    // pids_limit is optional on the caps shape.
    expectTypeOf<SessionCaps["pids_limit"]>().toEqualTypeOf<
      number | undefined
    >()
  })

  it("deployment singletons are constrained to the allowed enums", () => {
    expectTypeOf<DeploymentView["runtime_tier"]>().toEqualTypeOf<
      "runc" | "gvisor" | "firecracker"
    >()
    expectTypeOf<DeploymentView["runtime_provider"]>().toEqualTypeOf<
      "docker" | "k8s"
    >()
  })
})
