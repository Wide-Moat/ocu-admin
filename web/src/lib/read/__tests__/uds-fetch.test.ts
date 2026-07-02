// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createServer, type Server } from "node:http"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createUdsFetch } from "../uds-fetch"

// createUdsFetch builds a `fetch` bound to a Unix-domain socket — the server
// side of the BFF hop. The console's route handlers dial the control operator
// socket through it. These tests stand up a REAL HTTP server on a real unix
// socket in a temp dir (no mock — an actual socket round-trip) and assert the
// fetch reaches it, forwards the path, and surfaces the status and body. This
// is the only place a socket is dialed; everything above it is the already
// tested ReadClient contract (404 -> null, non-2xx -> ReadUnavailableError).

let dir: string
let socketPath: string
let server: Server
let seenMethods: string[]

function listenOnSocket(
  handler: (path: string) => { status: number; body: string },
): Promise<void> {
  server = createServer((req, res) => {
    seenMethods.push(req.method ?? "")
    const { status, body } = handler(req.url ?? "")
    res.writeHead(status, { "content-type": "application/json" })
    res.end(body)
  })
  return new Promise((resolve) => server.listen(socketPath, resolve))
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ocu-admin-uds-"))
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

describe("createUdsFetch", () => {
  it("dials the unix socket and returns the body on 200", async () => {
    await listenOnSocket(() => ({
      status: 200,
      body: JSON.stringify({ ok: true }),
    }))

    const udsFetch = createUdsFetch(socketPath)
    const res = await udsFetch("http://control/v1alpha/deployment")

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it("forwards the request path to the server", async () => {
    let seenPath = ""
    await listenOnSocket((path) => {
      seenPath = path
      return { status: 200, body: "[]" }
    })

    const udsFetch = createUdsFetch(socketPath)
    await udsFetch("http://control/v1alpha/sessions?include_released=true")

    expect(seenPath).toBe("/v1alpha/sessions?include_released=true")
  })

  it("surfaces a non-2xx status without throwing (the client maps it)", async () => {
    await listenOnSocket(() => ({ status: 503, body: "" }))

    const udsFetch = createUdsFetch(socketPath)
    const res = await udsFetch("http://control/v1alpha/sessions")

    expect(res.status).toBe(503)
  })
})
