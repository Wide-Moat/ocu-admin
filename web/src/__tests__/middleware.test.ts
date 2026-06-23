// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect, beforeAll } from "vitest"
import { NextRequest } from "next/server"
import { middleware, config } from "../middleware"
import { signSession } from "@/lib/auth/session"
import { SESSION_COOKIE } from "@/lib/auth/cookie"

const SECRET = "a-session-secret-at-least-32-bytes-long"

beforeAll(() => {
  process.env.OCU_ADMIN_OPERATOR_USER = "operator"
  process.env.OCU_ADMIN_OPERATOR_BCRYPT_HASH = "$2b$12$abcdefghijklmnopqrstuv"
  process.env.OCU_ADMIN_SESSION_SECRET = SECRET
})

function request(cookie?: string): NextRequest {
  const headers = new Headers()
  if (cookie) {
    headers.set("cookie", `${SESSION_COOKIE}=${cookie}`)
  }
  return new NextRequest("https://console.example/sessions", { headers })
}

describe("middleware auth gate", () => {
  it("passes a request carrying a valid session cookie", async () => {
    const token = await signSession("operator", SECRET)
    const res = await middleware(request(token))
    // NextResponse.next() has no 401 status.
    expect(res.status).not.toBe(401)
  })

  it("returns 401 when no session cookie is present", async () => {
    const res = await middleware(request())
    expect(res.status).toBe(401)
  })

  it("returns 401 on an invalid token", async () => {
    const res = await middleware(request("garbage.token.value"))
    expect(res.status).toBe(401)
  })

  it("does not gate the login route or static assets", () => {
    // The matcher must exclude the login POST so a logged-out operator can
    // still authenticate.
    expect(config.matcher[0]).toContain("api/auth/login")
    expect(config.matcher[0]).toContain("_next/static")
  })
})
