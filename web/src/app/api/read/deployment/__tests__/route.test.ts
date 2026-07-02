// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// The deployment BFF route, pinned against a REAL control-shaped HTTP server on
// a REAL unix socket (no mock). Four pins:
//
//  1. GET() returns 200 JSON whose body is exactly what the control socket
//     served — the stub serves gvisor/k8s, values the fixture does NOT hold
//     (firecracker/docker), so a route still returning fixture data cannot pass.
//  2. The stub actually SAW GET /v1alpha/deployment arrive over the socket —
//     the route really proxies, it does not synthesize.
//  3. Control answers 503 -> the route returns 503, never a 2xx with any body.
//  4. No socket at the configured path -> the route returns 503, never a 2xx.
//
// Pins 3 and 4 are the anti-fail-open probes: a route that silently falls back
// to fixture or default data when the control plane is down would hand the
// operator a healthy-looking dashboard over a dead deployment. The socket path
// reaches the route only via OCU_ADMIN_CONTROL_SOCKET, so env must be read per
// request (inside GET), never at module load.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createServer, type Server } from "node:http"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { GET } from "../route"
import type { DeploymentView } from "@/lib/read/types"

// Deliberately NOT the fixture values (fixture: firecracker/docker).
const STUB_DEPLOYMENT: DeploymentView = {
  runtime_tier: "gvisor",
  runtime_provider: "k8s",
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

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ocu-admin-dep-route-"))
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

describe("GET /api/read/deployment", () => {
  it("returns 200 with exactly the body the control socket served", async () => {
    await serve(() => ({
      status: 200,
      body: JSON.stringify(STUB_DEPLOYMENT),
    }))

    const res = await GET()

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/json")
    const body = (await res.json()) as DeploymentView
    expect(body).toEqual(STUB_DEPLOYMENT)
  })

  it("issues GET /v1alpha/deployment over the control socket", async () => {
    let seenPath = ""
    await serve((path) => {
      seenPath = path
      return { status: 200, body: JSON.stringify(STUB_DEPLOYMENT) }
    })

    await GET()

    expect(seenPath).toBe("/v1alpha/deployment")
  })

  it("maps a control 503 to a 503 response, never a 2xx fallback", async () => {
    await serve(() => ({ status: 503, body: "" }))

    const res = await GET()

    expect(res.status).toBe(503)
  })

  it("returns 503 when no socket exists at the configured path", async () => {
    // No server is started: socketPath points into the temp dir where nothing
    // listens. A fail-open route would still answer 2xx with fixture data.
    const res = await GET()

    expect(res.status).toBe(503)
  })
})
