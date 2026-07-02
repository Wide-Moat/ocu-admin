// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// The single-session BFF route, pinned against a REAL control-shaped HTTP
// server on a REAL unix socket (no mock). Five pins:
//
//  1. GET for a known key returns 200 JSON whose body is exactly the row the
//     control socket served, and the stub actually SAW GET
//     /v1alpha/sessions/{key} arrive — the route really dials control, it
//     does not look the key up locally.
//  2. Control answers 404 -> the route returns 404, and the stub SAW the
//     request — getSession's 404->null mapping survives the hop, and the 404
//     is control's verdict, never a local miss. The lookup runs over EVERY
//     session in the deployment (operator-sees-all per CONSTITUTION §8 /
//     ADR-0022), so a 404 means the key does not exist, period.
//  3. The key is URL-encoded on the wire: a key holding a space and a `..`
//     reaches the stub as ONE percent-encoded path segment, so a hostile key
//     cannot traverse into another control endpoint.
//  4. Control answers 503 -> the route returns 503, never a 2xx with any body.
//  5. No socket at the configured path -> the route returns 503 — and
//     SPECIFICALLY not 404. A fail-open route would answer 200 with a fixture
//     row, or 404 as if the key simply did not exist; a dead control plane
//     masquerading as a missing session would send the operator hunting for a
//     session instead of a transport, so this pin asserts 503, not merely
//     non-2xx.
//
// The stub row carries a tenant and key the fixture does NOT hold (fixture:
// acme / globex / initech), so a route still projecting fixture data cannot
// pass. Pins 4 and 5 are the anti-fail-open probes. The socket path reaches
// the route only via OCU_ADMIN_CONTROL_SOCKET, so env must be read per
// request (inside GET), never at module load.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createServer, type Server } from "node:http"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { GET } from "../route"
import type { SessionView } from "@/lib/read/types"

// Deliberately NOT a fixture tenant or key (fixture: acme/globex/initech),
// so fixture-projecting code can never satisfy these pins.
const STUB_ROW: SessionView = {
  key: "sess-c0ffee",
  owner: { tenant: "umbrella", caller: "batch-runner" },
  state: "active",
  container_name: "ocu-sb-c0ffee",
  caps: {
    cpu_cores: 1.5,
    memory_bytes: 3 * 1024 * 1024 * 1024, // 3 GiB, integer bytes
    pids_limit: 384,
  },
  reserved_at: "2026-07-01T09:05:00.000Z",
  active_at: "2026-07-01T09:05:07.000Z",
}

let dir: string
let socketPath: string
let server: Server | undefined
let seenMethods: string[]

type Route = (path: string) => { status: number; body: string }

function serve(route: Route): Promise<void> {
  server = createServer((req, res) => {
    seenMethods.push(req.method ?? "")
    const { status, body } = route(req.url ?? "")
    res.writeHead(status, { "content-type": "application/json" })
    res.end(body)
  })
  return new Promise((resolve) => server?.listen(socketPath, resolve))
}

// Next passes the dynamic segment via a `{ params }` context whose `params`
// is a Promise in the app router, already DECODED — the handler must re-encode
// the key before it reaches the wire.
function ctx(key: string): { params: Promise<{ key: string }> } {
  return { params: Promise.resolve({ key }) }
}

function req(key: string): Request {
  return new Request(
    `https://console.example/api/read/sessions/${encodeURIComponent(key)}`,
    { method: "GET" },
  )
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ocu-admin-session-key-route-"))
  // Extensionless filename on purpose: a UDS path needs no suffix, and the
  // bundle-secrecy pin forbids UDS-path markers anywhere in src/app, tests
  // included.
  socketPath = join(dir, "control")
  vi.stubEnv("OCU_ADMIN_CONTROL_SOCKET", socketPath)
  seenMethods = []
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
  // The read-only leaf emits only GETs, pinned at the socket: every request
  // that reached the wire in this test must have been a GET.
  expect(seenMethods.filter((m) => m !== "GET")).toEqual([])
})

describe("GET /api/read/sessions/[key]", () => {
  it("returns 200 with exactly the row the control socket served, via GET /v1alpha/sessions/{key}", async () => {
    let seenPath = ""
    await serve((path) => {
      seenPath = path
      return { status: 200, body: JSON.stringify(STUB_ROW) }
    })

    const res = await GET(req(STUB_ROW.key), ctx(STUB_ROW.key))

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/json")
    const body = (await res.json()) as SessionView
    expect(body).toEqual(STUB_ROW)
    expect(seenPath).toBe("/v1alpha/sessions/sess-c0ffee")
  })

  it("maps a control 404 to a 404 response — the miss is control's verdict, not a local one", async () => {
    let seenPath = ""
    await serve((path) => {
      seenPath = path
      return { status: 404, body: "" }
    })

    const res = await GET(req("sess-gone42"), ctx("sess-gone42"))

    expect(res.status).toBe(404)
    // The stub saw the request: the 404 crossed the hop; nothing answered
    // locally on control's behalf.
    expect(seenPath).toBe("/v1alpha/sessions/sess-gone42")
  })

  it("URL-encodes the key on the wire, so a hostile key stays one path segment", async () => {
    const hostile = "weird key/../x"
    let seenPath = ""
    await serve((path) => {
      seenPath = path
      return { status: 404, body: "" }
    })

    await GET(req(hostile), ctx(hostile))

    // One percent-encoded segment: the space and both slashes are escaped, so
    // the `..` cannot climb into another control endpoint.
    expect(seenPath).toBe("/v1alpha/sessions/weird%20key%2F..%2Fx")
  })

  it("maps a control 503 to a 503 response, never a 2xx fallback", async () => {
    await serve(() => ({ status: 503, body: "" }))

    const res = await GET(req(STUB_ROW.key), ctx(STUB_ROW.key))

    expect(res.status).toBe(503)
  })

  it("returns 503 — not 404 — when no socket exists at the configured path", async () => {
    // No server is started: socketPath points into the temp dir where nothing
    // listens. A fail-open route would answer 2xx with a fixture row, or 404
    // as if the key were simply absent — a dead control plane must not
    // masquerade as a missing session.
    const res = await GET(req(STUB_ROW.key), ctx(STUB_ROW.key))

    expect(res.status).toBe(503)
    expect(res.status).not.toBe(404)
  })
})
