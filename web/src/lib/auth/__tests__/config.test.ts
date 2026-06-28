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

  it("measures the floor in BYTES, not UTF-16 code units", () => {
    // The constant and message say "bytes", but `String.length` counts UTF-16
    // code units. A multi-byte secret therefore has more bytes of entropy than
    // its `.length` suggests: 20 × "é" is 20 code units but 40 UTF-8 bytes —
    // comfortably over the 32-byte floor. The byte measure must ACCEPT it.
    const multiByte = "é".repeat(20)
    expect(multiByte.length).toBe(20) // under the floor by code units
    expect(Buffer.byteLength(multiByte, "utf8")).toBe(40) // over the floor by bytes
    expect(() =>
      loadAuthConfig({ ...ENV, OCU_ADMIN_SESSION_SECRET: multiByte }),
    ).not.toThrow()
  })

  it("rejects a secret under the floor even when it is multi-byte", () => {
    // 10 × "é" is 10 code units and 20 UTF-8 bytes — still under 32 bytes.
    const shortMultiByte = "é".repeat(10)
    expect(Buffer.byteLength(shortMultiByte, "utf8")).toBe(20)
    expect(() =>
      loadAuthConfig({ ...ENV, OCU_ADMIN_SESSION_SECRET: shortMultiByte }),
    ).toThrow()
  })
})
