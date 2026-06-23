// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect } from "vitest"
import { loadAuthConfig } from "../config"

const ENV = {
  OCU_ADMIN_OPERATOR_USER: "operator",
  OCU_ADMIN_OPERATOR_BCRYPT_HASH: "$2b$12$abcdefghijklmnopqrstuv",
  OCU_ADMIN_SESSION_SECRET: "a-session-secret-at-least-32-bytes-long",
}

describe("auth config", () => {
  it("reads the three OCU_ADMIN_* values from the environment", () => {
    const cfg = loadAuthConfig(ENV)
    expect(cfg.operatorUser).toBe("operator")
    expect(cfg.operatorBcryptHash).toBe("$2b$12$abcdefghijklmnopqrstuv")
    expect(cfg.sessionSecret).toBe("a-session-secret-at-least-32-bytes-long")
  })

  it("throws if any required variable is missing (no fallback)", () => {
    for (const key of Object.keys(ENV)) {
      const partial = { ...ENV, [key]: undefined }
      expect(() => loadAuthConfig(partial)).toThrow()
    }
  })

  it("throws if the session secret is too short to be safe", () => {
    expect(() =>
      loadAuthConfig({ ...ENV, OCU_ADMIN_SESSION_SECRET: "too-short" }),
    ).toThrow()
  })
})
