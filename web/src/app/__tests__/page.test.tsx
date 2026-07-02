// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

// page.tsx is the fixture→BFF seam. These tests drive the SHIPPED `Home` server
// component end to end: they stub `next/headers` (so the server component can
// resolve an absolute origin) and the global `fetch` (so the in-process HTTP
// read client hits a canned BFF). A healthy BFF renders the sessions grid;
// a 503 from the read surface renders the unavailable banner — i.e. page.tsx
// maps a ReadUnavailableError to <Dashboard state="unavailable">, with no change
// to the Dashboard component itself.

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ host: "console.example", "x-forwarded-proto": "https" }),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// Route a same-origin BFF fetch to a canned Response keyed by URL suffix.
function installFetch(handler: (url: string) => Response): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString()
      return handler(url)
    }),
  )
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

import Home from "../page"
import { fixtureDeployment, fixtureSessions } from "@/lib/read/fixture"

const PROM =
  "ocu_session_start_seconds_sum 78\nocu_session_start_seconds_count 12\n"

describe("Home page (BFF read seam)", () => {
  it("renders the sessions grid when the BFF is healthy (state=ok)", async () => {
    installFetch((url) => {
      if (url.endsWith("/v1alpha/deployment")) {
        return json({ runtime_tier: "firecracker", runtime_provider: "docker" })
      }
      if (url.includes("/v1alpha/sessions")) {
        // The live list (no released rows), as the BFF would project it.
        return json(fixtureSessions.filter((s) => s.state !== "released"))
      }
      if (url.endsWith("/metrics")) {
        return new Response(PROM, {
          status: 200,
          headers: { "content-type": "text/plain" },
        })
      }
      return new Response(null, { status: 404 })
    })

    render(await Home())
    expect(screen.getByTestId("sessions-grid")).toBeTruthy()
    expect(screen.queryByTestId("unavailable-banner")).toBeNull()
  })

  it("renders the unavailable banner when the read surface returns 503", async () => {
    installFetch(() => new Response(null, { status: 503 }))

    render(await Home())
    expect(screen.getByTestId("unavailable-banner")).toBeTruthy()
    expect(screen.queryByTestId("sessions-grid")).toBeNull()
    // No display fail-open: with the read surface down the badge slots must be
    // honest "—" placeholders — never the fixture deployment's invented
    // tier/provider presented as fact over a dead deployment.
    const tier = screen.getByTestId("deployment-tier")
    const provider = screen.getByTestId("deployment-provider")
    expect(tier.textContent).toBe("—")
    expect(provider.textContent).toBe("—")
    expect(tier.textContent).not.toContain(fixtureDeployment.runtime_tier)
    expect(provider.textContent).not.toContain(
      fixtureDeployment.runtime_provider,
    )
  })
})
