// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect } from "vitest"
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  clearedCookieOptions,
  serializeCookie,
} from "../cookie"

describe("session cookie attributes", () => {
  it("is HttpOnly, SameSite=Strict, Secure, and path-scoped to root", () => {
    const opts = sessionCookieOptions()
    expect(opts.httpOnly).toBe(true)
    expect(opts.sameSite).toBe("strict")
    expect(opts.secure).toBe(true)
    expect(opts.path).toBe("/")
  })

  it("caps the cookie lifetime to the 8h operator shift", () => {
    const opts = sessionCookieOptions()
    // maxAge is seconds; 8h = 28800. Never longer than the token TTL.
    expect(opts.maxAge).toBe(8 * 60 * 60)
  })

  it("uses a stable, non-secret cookie name with the __Host- prefix", () => {
    expect(SESSION_COOKIE).toBe("__Host-ocu_admin_session")
  })

  it("clears the cookie with maxAge 0 and the same security attributes", () => {
    const opts = clearedCookieOptions()
    expect(opts.maxAge).toBe(0)
    expect(opts.httpOnly).toBe(true)
    expect(opts.sameSite).toBe("strict")
    expect(opts.secure).toBe(true)
    expect(opts.path).toBe("/")
  })

  it("serializes a Set-Cookie value with all security attributes", () => {
    const header = serializeCookie("the-token-value")
    expect(header).toContain(`${SESSION_COOKIE}=the-token-value`)
    expect(header).toContain("Path=/")
    expect(header).toContain("Max-Age=28800")
    expect(header).toContain("SameSite=Strict")
    expect(header).toContain("HttpOnly")
    expect(header).toContain("Secure")
  })

  it("serializes a cleared cookie with Max-Age=0 for logout", () => {
    const header = serializeCookie("", clearedCookieOptions())
    expect(header).toContain("Max-Age=0")
    expect(header).toContain("HttpOnly")
    expect(header).toContain("SameSite=Strict")
  })
})
