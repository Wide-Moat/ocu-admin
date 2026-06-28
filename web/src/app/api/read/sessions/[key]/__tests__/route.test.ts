// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect } from "vitest"
import { GET } from "../route"
import { fixtureSessions } from "@/lib/read/fixture"
import type { SessionView } from "@/lib/read/types"

// The single-session shipped GET. It looks the key up across EVERY session in
// the deployment (operator-sees-all per ADR-0022); a 404 means the key does not
// exist.

// Next passes the dynamic segment via a `{ params }` context whose `params` is a
// Promise in the app router; the shipped handler awaits it.
function ctx(key: string): { params: Promise<{ key: string }> } {
  return { params: Promise.resolve({ key }) }
}

function req(key: string): Request {
  return new Request(`https://console.example/api/read/sessions/${key}`, {
    method: "GET",
  })
}

describe("GET /api/read/sessions/[key]", () => {
  it("returns 200 and the row for a known key", async () => {
    const target = fixtureSessions[0]
    const res = await GET(req(target.key), ctx(target.key))
    expect(res.status).toBe(200)
    const body = (await res.json()) as SessionView
    expect(body.key).toBe(target.key)
  })

  it("returns 404 for an unknown key", async () => {
    const res = await GET(req("does-not-exist"), ctx("does-not-exist"))
    expect(res.status).toBe(404)
  })
})
