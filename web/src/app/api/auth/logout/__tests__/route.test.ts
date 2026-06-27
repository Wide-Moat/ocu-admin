// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect } from "vitest"
import { POST } from "../route"
import { SESSION_COOKIE } from "@/lib/auth/cookie"

describe("POST /api/auth/logout", () => {
  it("clears the session cookie and returns 204", async () => {
    const res = await POST()
    expect(res.status).toBe(204)
    const setCookie = res.headers.get("set-cookie") ?? ""
    // Names the session cookie, sets an EMPTY value, and tells the browser to
    // drop it now. The empty value matters: clearing the cookie must overwrite
    // the token, not just expire some non-empty payload.
    expect(setCookie).toContain(`${SESSION_COOKIE}=;`)
    expect(setCookie).toContain("Max-Age=0")
    // Same security attributes the login route minted it with.
    expect(setCookie.toLowerCase()).toContain("httponly")
    expect(setCookie.toLowerCase()).toContain("secure")
    expect(setCookie.toLowerCase()).toContain("samesite=strict")
    expect(setCookie.toLowerCase()).toContain("path=/")
  })

  it("clears the cookie unconditionally — it reads no request body", async () => {
    // The middleware gate already proved identity to reach this handler, so
    // logout takes no input; a bare POST clears the cookie all the same.
    const res = await POST()
    expect(res.status).toBe(204)
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0")
  })
})
