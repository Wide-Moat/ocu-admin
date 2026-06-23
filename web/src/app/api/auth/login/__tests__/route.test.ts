// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect, beforeAll } from "vitest"
import bcrypt from "bcryptjs"
import { POST } from "../route"
import { BCRYPT_COST } from "@/lib/auth/credential"
import { SESSION_COOKIE } from "@/lib/auth/cookie"

const USER = "operator"
const PASSWORD = "correct-horse-battery-staple"
const SECRET = "a-session-secret-at-least-32-bytes-long"

beforeAll(async () => {
  const hash = await bcrypt.hash(PASSWORD, BCRYPT_COST)
  process.env.OCU_ADMIN_OPERATOR_USER = USER
  process.env.OCU_ADMIN_OPERATOR_BCRYPT_HASH = hash
  process.env.OCU_ADMIN_SESSION_SECRET = SECRET
})

function loginRequest(body: unknown): Request {
  return new Request("https://console.example/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/auth/login", () => {
  it("sets an HttpOnly session cookie on correct credentials", async () => {
    const res = await POST(loginRequest({ username: USER, password: PASSWORD }))
    expect(res.status).toBe(204)
    const setCookie = res.headers.get("set-cookie") ?? ""
    expect(setCookie).toContain(`${SESSION_COOKIE}=`)
    expect(setCookie.toLowerCase()).toContain("httponly")
    expect(setCookie.toLowerCase()).toContain("samesite=strict")
    expect(setCookie.toLowerCase()).toContain("secure")
  })

  it("returns 401 and sets no cookie on a wrong password", async () => {
    const res = await POST(loginRequest({ username: USER, password: "nope" }))
    expect(res.status).toBe(401)
    expect(res.headers.get("set-cookie")).toBeNull()
  })

  it("returns 401 on a wrong username", async () => {
    const res = await POST(
      loginRequest({ username: "intruder", password: PASSWORD }),
    )
    expect(res.status).toBe(401)
  })

  it("returns 400 on valid JSON missing the credential fields", async () => {
    const res = await POST(loginRequest({ nope: true }))
    expect(res.status).toBe(400)
  })

  it("returns 400 on a malformed body", async () => {
    const res = await POST(
      new Request("https://console.example/api/auth/login", {
        method: "POST",
        body: "not json",
      }),
    )
    expect(res.status).toBe(400)
  })
})
