// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect } from "vitest"
import { GET } from "../route"
import { fixtureDeployment } from "@/lib/read/fixture"
import type { DeploymentView } from "@/lib/read/types"

// The deployment-singletons shipped GET. Deployment-wide, so it carries no
// per-tenant scope, but it is still a read-only all-GET projection of the
// fixture.

describe("GET /api/read/deployment", () => {
  it("returns 200 and the deployment singletons as JSON", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/json")
    const body = (await res.json()) as DeploymentView
    expect(body.runtime_tier).toBe(fixtureDeployment.runtime_tier)
    expect(body.runtime_provider).toBe(fixtureDeployment.runtime_provider)
  })
})
