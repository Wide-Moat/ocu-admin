// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// The sessions BFF route, pinned against a REAL control-shaped HTTP server on
// a REAL unix socket (no mock). Five pins:
//
//  1. GET returns 200 JSON whose body is exactly the rows the control socket
//     served, and the stub actually SAW GET /v1alpha/sessions arrive with no
//     query — the route really proxies, it does not project locally.
//  2. `?include_released=true` on the inbound request reaches the stub as
//     /v1alpha/sessions?include_released=true — the tombstone knob is
//     FORWARDED to control, never applied locally.
//  3. Rows from several different tenants all come back unchanged —
//     operator-sees-all (CONSTITUTION §8 / ADR-0022): the BFF never scopes
//     the read by tenant.
//  4. Control answers 503 -> the route returns 503, never a 2xx with any body.
//  5. No socket at the configured path -> the route returns 503, never a 2xx.
//
// The stub rows carry tenants and keys the fixture does NOT hold (fixture:
// acme / globex / initech), so a route still projecting fixture data cannot
// pass. Pins 4 and 5 are the anti-fail-open probes: a route that silently
// falls back to fixture rows when the control plane is down would hand the
// operator a healthy-looking session grid over a dead deployment. The socket
// path reaches the route only via OCU_ADMIN_CONTROL_SOCKET, so env must be
// read per request (inside GET), never at module load.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createServer, type Server } from "node:http"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { GET } from "../route"
import type { SessionView } from "@/lib/read/types"

// Deliberately NOT the fixture tenants or keys (fixture: acme/globex/initech),
// so fixture-projecting code can never satisfy these pins.
const STUB_SESSIONS: SessionView[] = [
  {
    key: "sess-c0ffee",
    owner: { tenant: "umbrella", caller: "batch-runner" },
    state: "reserved",
    reserved_at: "2026-07-01T09:12:00.000Z",
  },
  {
    key: "sess-f00d42",
    owner: { tenant: "wayne", caller: "scheduler" },
    state: "active",
    container_name: "ocu-sb-f00d42",
    caps: {
      cpu_cores: 1.5,
      memory_bytes: 3 * 1024 * 1024 * 1024, // 3 GiB, integer bytes
      pids_limit: 384,
    },
    reserved_at: "2026-07-01T09:05:00.000Z",
    active_at: "2026-07-01T09:05:07.000Z",
  },
  {
    key: "sess-beef99",
    owner: { tenant: "stark", caller: "api-bot" },
    state: "released",
    container_name: "ocu-sb-beef99",
    caps: {
      cpu_cores: 0.25,
      memory_bytes: 512 * 1024 * 1024, // 512 MiB, integer bytes
      pids_limit: 128,
    },
    reserved_at: "2026-07-01T08:30:00.000Z",
    active_at: "2026-07-01T08:30:05.000Z",
  },
]

let dir: string
let socketPath: string
let server: Server | undefined

type Route = (path: string) => { status: number; body: string }

function serve(route: Route): Promise<void> {
  server = createServer((req, res) => {
    const { status, body } = route(req.url ?? "")
    res.writeHead(status, { "content-type": "application/json" })
    res.end(body)
  })
  return new Promise((resolve) => server?.listen(socketPath, resolve))
}

function req(url: string): Request {
  return new Request(url, { method: "GET" })
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ocu-admin-sessions-route-"))
  // Extensionless filename on purpose: a UDS path needs no suffix, and the
  // bundle-secrecy pin forbids UDS-path markers anywhere in src/app, tests
  // included.
  socketPath = join(dir, "control")
  vi.stubEnv("OCU_ADMIN_CONTROL_SOCKET", socketPath)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await new Promise<void>((resolve) => {
    if (server?.listening) {
      server.close(() => resolve())
    } else {
      resolve()
    }
  })
  server = undefined
  rmSync(dir, { recursive: true, force: true })
})

describe("GET /api/read/sessions", () => {
  it("returns 200 with exactly the rows the control socket served, via GET /v1alpha/sessions", async () => {
    let seenPath = ""
    await serve((path) => {
      seenPath = path
      return { status: 200, body: JSON.stringify(STUB_SESSIONS) }
    })

    const res = await GET(req("https://console.example/api/read/sessions"))

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/json")
    const body = (await res.json()) as SessionView[]
    expect(body).toEqual(STUB_SESSIONS)
    expect(seenPath).toBe("/v1alpha/sessions")
  })

  it("forwards ?include_released=true to control instead of applying it locally", async () => {
    let seenPath = ""
    await serve((path) => {
      seenPath = path
      return { status: 200, body: JSON.stringify(STUB_SESSIONS) }
    })

    await GET(
      req("https://console.example/api/read/sessions?include_released=true"),
    )

    expect(seenPath).toBe("/v1alpha/sessions?include_released=true")
  })

  it("returns every tenant's rows unchanged — operator-sees-all, no per-tenant scoping", async () => {
    await serve(() => ({ status: 200, body: JSON.stringify(STUB_SESSIONS) }))

    const res = await GET(req("https://console.example/api/read/sessions"))

    const body = (await res.json()) as SessionView[]
    expect(body).toHaveLength(STUB_SESSIONS.length)
    const tenants = new Set(body.map((s) => s.owner.tenant))
    expect(tenants).toEqual(new Set(["umbrella", "wayne", "stark"]))
  })

  it("maps a control 503 to a 503 response, never a 2xx fallback", async () => {
    await serve(() => ({ status: 503, body: "" }))

    const res = await GET(req("https://console.example/api/read/sessions"))

    expect(res.status).toBe(503)
  })

  it("returns 503 when no socket exists at the configured path", async () => {
    // No server is started: socketPath points into the temp dir where nothing
    // listens. A fail-open route would still answer 2xx with fixture rows.
    const res = await GET(req("https://console.example/api/read/sessions"))

    expect(res.status).toBe(503)
  })
})
