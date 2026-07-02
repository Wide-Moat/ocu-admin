// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// The server side of the BFF hop. The console's route handlers reach the
// control operator plane over its Unix-domain socket — never a TCP port, never
// from the browser. This builds a `fetch` pinned to that socket via an undici
// Agent whose connector dials `socketPath`. The URL host in a request is a
// throwaway (the socket ignores it); only the path + query reach the server.
//
// The result is a drop-in `fetch`, so the already-tested ReadClient contract
// (404 -> null, non-2xx -> ReadUnavailableError, Prometheus-text parsing) rides
// on top unchanged — this module owns only the transport.
//
// The transport bounds its wait: connect, headers, and body are each capped
// (defaults below, tuned for a local unix socket), so a control plane that
// accepts the dial and never answers becomes a rejected fetch — an unavailable
// read in seconds — instead of parking every route and the SSR render on
// undici's 300s defaults.
//
// This is a read-only leaf: it issues GETs a caller hands it and imports no
// control-plane authority. Access to the socket is an OS-level guard: the
// operator socket lives in a 0700 directory, so only a process running as that
// directory's owner can connect at all (ADR-0004 operator-scoped peer); control
// attests the peer's uid via SO_PEERCRED and needs nothing in the request.

import { Agent, fetch as undiciFetch } from "undici"

// Default dial bounds for an ops console reading a local unix socket: the
// connect is same-host (fast or dead), and a healthy control answers a read
// well inside single-digit seconds. Exported so tests and docs state one truth.
export const DEFAULT_CONNECT_TIMEOUT_MS = 1_000
export const DEFAULT_HEADERS_TIMEOUT_MS = 5_000
export const DEFAULT_BODY_TIMEOUT_MS = 5_000

/**
 * Build a `fetch` bound to the Unix-domain socket at `socketPath`. Every request
 * it issues is dialed over that socket regardless of the URL host. Returns a
 * value typed as the global `fetch` so it slots into `createHttpReadClient`'s
 * `deps.fetch` seam with no other change.
 *
 * `timeouts` bounds the dial (connect / response headers / body), defaulting
 * to the constants above; a breached bound rejects the fetch, which callers
 * already map to the unavailable state.
 */
export function createUdsFetch(
  socketPath: string,
  timeouts: {
    connectTimeoutMs?: number
    headersTimeoutMs?: number
    bodyTimeoutMs?: number
  } = {},
): typeof fetch {
  const {
    connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS,
    headersTimeoutMs = DEFAULT_HEADERS_TIMEOUT_MS,
    bodyTimeoutMs = DEFAULT_BODY_TIMEOUT_MS,
  } = timeouts

  const dispatcher = new Agent({
    connect: { socketPath, timeout: connectTimeoutMs },
    headersTimeout: headersTimeoutMs,
    bodyTimeout: bodyTimeoutMs,
  })

  return ((input: string | URL | Request, init?: RequestInit) =>
    undiciFetch(input as Parameters<typeof undiciFetch>[0], {
      ...(init as Parameters<typeof undiciFetch>[1]),
      dispatcher,
    })) as unknown as typeof fetch
}
