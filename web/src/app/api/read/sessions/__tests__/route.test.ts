// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect } from "vitest"
import { GET } from "../route"
import { fixtureSessions } from "@/lib/read/fixture"
import type { SessionView } from "@/lib/read/types"

// These tests import the SHIPPED `GET` export and call it. The handler returns
// EVERY session in the deployment (operator-sees-all per ADR-0022); there is no
// per-tenant scoping of the read.

function req(url: string): Request {
  return new Request(url, { method: "GET" })
}

async function rows(res: Response): Promise<SessionView[]> {
  return (await res.json()) as SessionView[]
}

describe("GET /api/read/sessions", () => {
  it("returns 200 and a JSON array of session rows", async () => {
    const res = await GET(req("https://console.example/api/read/sessions"))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/json")
    const body = await rows(res)
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
  })

  it("hides released tombstones by default and surfaces them with ?include_released", async () => {
    const live = await rows(
      await GET(req("https://console.example/api/read/sessions")),
    )
    expect(live.every((s) => s.state !== "released")).toBe(true)

    const withTombstones = await rows(
      await GET(
        req("https://console.example/api/read/sessions?include_released=true"),
      ),
    )
    expect(withTombstones.some((s) => s.state === "released")).toBe(true)
  })

  it("projects every session from every tenant — operator-sees-all, no per-tenant scoping", async () => {
    // The handler returns rows from ALL tenants present in the fixture; nothing
    // is filtered out by tenant. The returned set of tenants must equal the
    // distinct tenants in the fixture (acme, globex, initech).
    const body = await rows(
      await GET(
        req("https://console.example/api/read/sessions?include_released=true"),
      ),
    )
    const returnedTenants = new Set(body.map((s) => s.owner.tenant))
    const fixtureTenants = new Set(fixtureSessions.map((s) => s.owner.tenant))
    expect(fixtureTenants.size).toBeGreaterThan(1)
    for (const tenant of fixtureTenants) {
      expect(returnedTenants.has(tenant)).toBe(true)
    }
  })

  it("the absent-until-active invariant holds on every returned row", async () => {
    const body = await rows(
      await GET(
        req("https://console.example/api/read/sessions?include_released=true"),
      ),
    )
    for (const s of body) {
      if (s.state === "reserved") {
        expect(s.caps).toBeUndefined()
        expect(s.active_at).toBeUndefined()
        expect(s.container_name).toBeUndefined()
      }
    }
  })
})
