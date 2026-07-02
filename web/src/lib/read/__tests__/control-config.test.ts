// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, expect, it } from "vitest"
import { DEFAULT_CONTROL_SOCKET, loadControlConfig } from "../control-config"

// Where the console finds the control operator socket. Unlike the auth secrets
// (which forbid a default), the socket path has a safe fleet-convention default
// — /run/ocu-control/operator.sock — so a stock deployment needs no extra env.
// An operator overrides it with OCU_ADMIN_CONTROL_SOCKET when the socket lives
// elsewhere.

describe("loadControlConfig", () => {
  it("defaults the socket path to the fleet convention", () => {
    const cfg = loadControlConfig({})
    expect(cfg.socketPath).toBe(DEFAULT_CONTROL_SOCKET)
    expect(cfg.socketPath).toBe("/run/ocu-control/operator.sock")
  })

  it("honours OCU_ADMIN_CONTROL_SOCKET when set", () => {
    const cfg = loadControlConfig({
      OCU_ADMIN_CONTROL_SOCKET: "/var/run/custom/op.sock",
    })
    expect(cfg.socketPath).toBe("/var/run/custom/op.sock")
  })

  it("ignores an empty override and falls back to the default", () => {
    const cfg = loadControlConfig({ OCU_ADMIN_CONTROL_SOCKET: "" })
    expect(cfg.socketPath).toBe(DEFAULT_CONTROL_SOCKET)
  })
})
