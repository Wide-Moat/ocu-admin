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

function request(cookie?: string, path = "/sessions"): NextRequest {
  const headers = new Headers()
  if (cookie) {
    headers.set("cookie", `${SESSION_COOKIE}=${cookie}`)
  }
  return new NextRequest(`https://console.example${path}`, { headers })
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

// The privacy of the entire read surface — and the page's SSR
// cookie-forwarding, which is only safe because the fetch it forwards the
// session cookie to is itself gated — rests on the canon read paths and the
// mounted BFF handlers staying INSIDE the matcher. The matcher is a single
// negative-lookahead pattern `/((?!alt1|alt2|...).*)`: a path escapes the
// gate exactly when one alternative is a prefix of it (the alternatives are
// written without the leading `/` the pattern consumes). The pin extracts
// the alternatives and demands none of them prefixes any read-surface path,
// so carving a read path out of the matcher turns this red.

const READ_SURFACE_PATHS = [
  "/",
  "/v1alpha/sessions",
  "/v1alpha/sessions/some-key",
  "/v1alpha/deployment",
  "/metrics",
  "/api/read/sessions",
  "/api/read/deployment",
  "/api/read/metrics",
]

function matcherExclusions(pattern: string): string[] {
  const lookahead = pattern.match(/\(\?!([^)]*)\)/)
  if (!lookahead) {
    throw new Error(`matcher is not a negative-lookahead pattern: ${pattern}`)
  }
  return lookahead[1].split("|")
}

describe("middleware matcher keeps the read surface gated", () => {
  it("excludes no canon read path or mounted handler from the gate", () => {
    const exclusions = matcherExclusions(config.matcher[0])
    // The parse must yield the known exclusions; an empty or mis-parsed list
    // would make the prefix pin below vacuous.
    expect(exclusions).toContain("api/auth/login")

    for (const path of READ_SURFACE_PATHS) {
      const bare = path.slice(1)
      const carvedBy = exclusions.filter((alt) => bare.startsWith(alt))
      expect(carvedBy, `${path} must stay inside the auth gate`).toEqual([])
    }
  })

  it.each(["/v1alpha/sessions", "/api/read/deployment", "/metrics"])(
    "answers 401 to a cookie-less request for %s",
    async (path) => {
      const res = await middleware(request(undefined, path))
      expect(res.status).toBe(401)
    },
  )
})
