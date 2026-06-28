// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect } from "vitest"
import { signSession } from "../session"
import { isAuthorized } from "../gate"

const SECRET = "a-session-secret-at-least-32-bytes-long"

describe("request authorization gate", () => {
  it("authorizes a request carrying a valid session token", async () => {
    const token = await signSession("operator", SECRET)
    await expect(isAuthorized(token, SECRET)).resolves.toBe(true)
  })

  it("rejects a missing token (no fallback)", async () => {
    await expect(isAuthorized(undefined, SECRET)).resolves.toBe(false)
    await expect(isAuthorized("", SECRET)).resolves.toBe(false)
  })

  it("rejects a token signed with a different secret", async () => {
    const token = await signSession("operator", SECRET)
    await expect(
      isAuthorized(token, "a-DIFFERENT-session-secret-32-bytes-xx"),
    ).resolves.toBe(false)
  })

  it("rejects a forged alg:none token", async () => {
    const b64 = (o: unknown) =>
      Buffer.from(JSON.stringify(o)).toString("base64url")
    const forged = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "operator", exp: 9999999999 })}.`
    await expect(isAuthorized(forged, SECRET)).resolves.toBe(false)
  })
})
