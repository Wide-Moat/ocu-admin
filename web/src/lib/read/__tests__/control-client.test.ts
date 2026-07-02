// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createServer, type Server } from "node:http"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createControlReadClient } from "../control-client"
import { ReadUnavailableError } from "../client"

// createControlReadClient wires the three pieces — control-config (socket path),
// uds-fetch (transport), and the existing createHttpReadClient (contract) — into
// the ReadClient the routes use. These tests drive the whole stack against a
// REAL control-shaped HTTP server on a REAL unix socket (no mock): a request to
// a ReadClient method must travel config -> socket -> server and back as parsed,
// typed data, and a control 503 must surface as the typed ReadUnavailableError
// the dashboard renders as state="unavailable".

let dir: string
let socketPath: string
let server: Server
let seenMethods: string[]

type Route = (path: string) => { status: number; body: string }

function serve(route: Route): Promise<void> {
  server = createServer((req, res) => {
    seenMethods.push(req.method ?? "")
    const { status, body } = route(req.url ?? "")
    res.writeHead(status, { "content-type": "application/json" })
    res.end(body)
  })
  return new Promise((resolve) => server.listen(socketPath, resolve))
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ocu-admin-ctl-"))
  socketPath = join(dir, "operator.sock")
  seenMethods = []
})

afterEach(async () => {
  await new Promise<void>((resolve) => {
    if (server?.listening) {
      server.close(() => resolve())
    } else {
      resolve()
    }
  })
  rmSync(dir, { recursive: true, force: true })
  // The read-only leaf emits only GETs, pinned at the socket: every request
  // that reached the wire in this test must have been a GET.
  expect(seenMethods.filter((m) => m !== "GET")).toEqual([])
})

describe("createControlReadClient", () => {
  it("getDeployment travels the full stack and parses the control JSON", async () => {
    await serve(() => ({
      status: 200,
      body: JSON.stringify({
        runtime_tier: "firecracker",
        runtime_provider: "docker",
      }),
    }))

    const client = createControlReadClient({
      OCU_ADMIN_CONTROL_SOCKET: socketPath,
    })
    const dep = await client.getDeployment()

    expect(dep.runtime_tier).toBe("firecracker")
    expect(dep.runtime_provider).toBe("docker")
  })

  it("listSessions hits GET /v1alpha/sessions on the control socket", async () => {
    let seenPath = ""
    await serve((path) => {
      seenPath = path
      return {
        status: 200,
        body: JSON.stringify([
          {
            key: "sess-1",
            owner: { tenant: "acme", caller: "uid:1000" },
            state: "active",
            reserved_at: "2025-01-01T00:00:00Z",
          },
        ]),
      }
    })

    const client = createControlReadClient({
      OCU_ADMIN_CONTROL_SOCKET: socketPath,
    })
    const rows = await client.listSessions()

    expect(seenPath).toBe("/v1alpha/sessions")
    expect(rows).toHaveLength(1)
    expect(rows[0].key).toBe("sess-1")
  })

  it("maps a control 503 to a typed ReadUnavailableError", async () => {
    await serve(() => ({ status: 503, body: "" }))

    const client = createControlReadClient({
      OCU_ADMIN_CONTROL_SOCKET: socketPath,
    })

    await expect(client.listSessions()).rejects.toBeInstanceOf(
      ReadUnavailableError,
    )
  })

  it("returns null for a missing session (control 404)", async () => {
    await serve(() => ({ status: 404, body: "" }))

    const client = createControlReadClient({
      OCU_ADMIN_CONTROL_SOCKET: socketPath,
    })
    const row = await client.getSession("nope")

    expect(row).toBeNull()
  })
})
