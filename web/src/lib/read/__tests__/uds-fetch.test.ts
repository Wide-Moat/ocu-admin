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

// The stalled-control shape: accept the connection, read the request, never
// write a byte back. Without a bounded dial this holds the fetch open for
// undici's 300s default — the exact hang the timeout options exist to kill.
function listenAndNeverRespond(): Promise<void> {
  server = createServer((req) => {
    seenMethods.push(req.method ?? "")
    // Intentionally no response: the request parks until the client gives up.
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
      // A stalled connection (the never-respond pin) would otherwise hold
      // `close` open until the client side is torn down; sever it eagerly.
      server.closeAllConnections()
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

  // A control that accepts the dial and never answers must surface as a
  // rejected fetch (the routes' catch-all maps that to 503 / unavailable),
  // not as an unbounded hang that parks the SSR render on undici's 300s
  // defaults. Tiny timeouts keep the test fast; the 5s vitest timeout turns
  // a hang into a failure instead of a stuck suite.
  it(
    "rejects instead of hanging when control accepts but never answers",
    { timeout: 5_000 },
    async () => {
      await listenAndNeverRespond()

      const udsFetch = createUdsFetch(socketPath, {
        connectTimeoutMs: 200,
        headersTimeoutMs: 200,
        bodyTimeoutMs: 200,
      })

      await expect(
        udsFetch("http://control/v1alpha/deployment"),
      ).rejects.toThrow()
    },
  )

  // Proving the no-argument defaults behaviorally would need a stall longer
  // than the 5s headers default — too slow for a unit suite. Instead the pin
  // splits: the stall test above proves the options are actually wired into
  // the dial (tiny timeouts change behavior), and this test pins the exported
  // default constants to finite values of at most 5s, killing a revert to
  // undici's 300s defaults at the constant level. `createUdsFetch(socketPath)`
  // falls back to exactly these constants, so together the two pins bound the
  // default dial. Namespace access (not a static named import) keeps a deleted
  // constant an assertion failure here rather than a whole-file import crash.
  it("exports finite default timeouts of at most 5s each", async () => {
    const mod = await import("../uds-fetch")
    const defaults = [
      mod.DEFAULT_CONNECT_TIMEOUT_MS,
      mod.DEFAULT_HEADERS_TIMEOUT_MS,
      mod.DEFAULT_BODY_TIMEOUT_MS,
    ]

    for (const ms of defaults) {
      expect(Number.isFinite(ms)).toBe(true)
      expect(ms).toBeGreaterThan(0)
      expect(ms).toBeLessThanOrEqual(5_000)
    }
  })
})
