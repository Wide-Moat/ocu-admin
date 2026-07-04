// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

// page.tsx is the fixture→BFF seam. These tests drive the SHIPPED `Home` server
// component end to end: they stub `next/headers` (the cookie-forwarding seam)
// and the global `fetch` (so the in-process HTTP read client hits a canned
// BFF). A healthy BFF renders the sessions grid; a 503 from the read surface
// renders the unavailable banner — i.e. page.tsx maps a ReadUnavailableError
// to <Dashboard state="unavailable">, with no change to the Dashboard
// component itself.
//
// CONTRACT CHANGE: the page no longer derives its self-fetch base from the
// inbound host / x-forwarded-* headers — it dials the process's own loopback
// listener at `http://127.0.0.1:${PORT ?? 3000}`. The stubbed inbound headers
// therefore feed ONLY the cookie forwarding; the loopback pins below prove
// that no inbound header can steer where the operator's cookie is sent.
//
// The cookie pins guard the SSR auth seam: the read paths sit behind the same
// session gate as the page itself, and the server component's fetch to its own
// origin is a fresh request, so the page must forward the inbound request's
// cookie header verbatim on every read — and forward nothing when the inbound
// request carries no cookie.

// Mutable inbound-request state the `next/headers` mock reflects: the cookie
// and the non-cookie headers (host / x-forwarded-*, hostile in the loopback
// pins). Tests set them, afterEach resets them. (vi.hoisted so the hoisted
// mock factory can see it.)
const inbound = vi.hoisted(() => ({
  cookie: null as string | null,
  headers: {
    host: "console.example",
    "x-forwarded-proto": "https",
  } as Record<string, string>,
}))

vi.mock("next/headers", () => ({
  headers: async () => {
    const h = new Headers(inbound.headers)
    if (inbound.cookie !== null) {
      h.set("cookie", inbound.cookie)
    }
    return h
  },
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  inbound.cookie = null
  inbound.headers = {
    host: "console.example",
    "x-forwarded-proto": "https",
  }
})

// Route a same-origin BFF fetch to a canned Response keyed by URL suffix.
// Returns the installed mock so tests can inspect the recorded calls.
function installFetch(handler: (url: string) => Response) {
  const mock = vi.fn<typeof fetch>(async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : input.toString()
    return handler(url)
  })
  vi.stubGlobal("fetch", mock)
  return mock
}

// The cookie header a recorded fetch call would send, from whichever slot
// carries it (an explicit init or a prebuilt Request). Null when none.
function sentCookie([input, init]: Parameters<typeof fetch>): string | null {
  const fromInit = new Headers(init?.headers).get("cookie")
  if (fromInit !== null) {
    return fromInit
  }
  return input instanceof Request ? input.headers.get("cookie") : null
}

// The URL a recorded fetch call dialed, from whichever input shape carried it.
function sentUrl([input]: Parameters<typeof fetch>): string {
  return typeof input === "string"
    ? input
    : input instanceof Request
      ? input.url
      : input.toString()
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

import Home from "../page"
import { fixtureDeployment, fixtureSessions } from "@/lib/read/fixture"

const PROM =
  "ocu_control_session_start_seconds_sum 78\nocu_control_session_start_seconds_count 12\n"

// A healthy BFF: canned 200s for the three reads the page issues.
function healthyBff(url: string): Response {
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
}

describe("Home page (BFF read seam)", () => {
  it("renders the sessions grid when the BFF is healthy (state=ok)", async () => {
    installFetch(healthyBff)

    render(await Home())
    expect(screen.getByTestId("sessions-grid")).toBeTruthy()
    expect(screen.queryByTestId("unavailable-banner")).toBeNull()
  })

  it("forwards the inbound request's cookie verbatim on every read", async () => {
    const SESSION_COOKIE = "__Host-ocu_admin_session=eyJhbGciOi.payload.sig"
    inbound.cookie = SESSION_COOKIE
    const fetchMock = installFetch(healthyBff)

    render(await Home())

    // All three reads (deployment, sessions, metrics) — each carrying the
    // inbound cookie header exactly as received.
    expect(fetchMock.mock.calls).toHaveLength(3)
    for (const call of fetchMock.mock.calls) {
      expect(sentCookie(call)).toBe(SESSION_COOKIE)
    }
  })

  it("sends no cookie header when the inbound request carries none", async () => {
    const fetchMock = installFetch(healthyBff)

    render(await Home())

    // No cookie in → no cookie out: neither a header nor a stringified-null
    // artifact (sentCookie would surface `cookie: "null"` as "null").
    expect(fetchMock.mock.calls).toHaveLength(3)
    for (const call of fetchMock.mock.calls) {
      expect(sentCookie(call)).toBeNull()
    }
  })

  it("dials only its own loopback listener, never an inbound-header-named host", async () => {
    // HOSTILE pin: a fronting proxy that passes client-supplied forwarded
    // headers must not be able to name where the session cookie is sent. The
    // self-fetch targets this process's own Next listener, so no inbound host
    // header is ever a legitimate input to the base URL.
    inbound.headers = {
      host: "also-evil.example",
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
    }
    inbound.cookie = "__Host-ocu_admin_session=eyJhbGciOi.payload.sig"
    const fetchMock = installFetch(healthyBff)

    render(await Home())

    expect(fetchMock.mock.calls).toHaveLength(3)
    for (const call of fetchMock.mock.calls) {
      const url = sentUrl(call)
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:3000\//)
      expect(url).not.toContain("evil")
    }
  })

  it("dials the loopback port from process.env.PORT, read at request time", async () => {
    vi.stubEnv("PORT", "4321")
    const fetchMock = installFetch(healthyBff)

    render(await Home())

    expect(fetchMock.mock.calls).toHaveLength(3)
    for (const call of fetchMock.mock.calls) {
      expect(sentUrl(call)).toMatch(/^http:\/\/127\.0\.0\.1:4321\//)
    }
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
    // Same honesty for the stat tiles: with the read surface down there is no
    // session count and no mean start time — both value slots must be "—"
    // placeholders, never a normal-looking "0" next to the banner.
    const activeValue = screen.getByTestId("stat-active-value")
    const avgStartValue = screen.getByTestId("stat-avg-start-value")
    expect(activeValue.textContent).toBe("—")
    expect(avgStartValue.textContent).toBe("—")
  })
})
