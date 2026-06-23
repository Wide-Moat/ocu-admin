// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect } from "vitest"
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  clearedCookieOptions,
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

  it("uses a stable, non-secret cookie name", () => {
    expect(SESSION_COOKIE).toBe("ocu_admin_session")
  })

  it("clears the cookie with maxAge 0 and the same security attributes", () => {
    const opts = clearedCookieOptions()
    expect(opts.maxAge).toBe(0)
    expect(opts.httpOnly).toBe(true)
    expect(opts.sameSite).toBe("strict")
    expect(opts.secure).toBe(true)
    expect(opts.path).toBe("/")
  })
})
