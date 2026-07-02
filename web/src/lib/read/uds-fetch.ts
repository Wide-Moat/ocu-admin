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
// This is a read-only leaf: it issues GETs a caller hands it and imports no
// control-plane authority. Access to the socket is an OS-level guard: the
// operator socket lives in a 0700 directory, so only a process running as that
// directory's owner can connect at all (ADR-0004 operator-scoped peer); control
// attests the peer's uid via SO_PEERCRED and needs nothing in the request.

import { Agent, fetch as undiciFetch } from "undici"

/**
 * Build a `fetch` bound to the Unix-domain socket at `socketPath`. Every request
 * it issues is dialed over that socket regardless of the URL host. Returns a
 * value typed as the global `fetch` so it slots into `createHttpReadClient`'s
 * `deps.fetch` seam with no other change.
 */
export function createUdsFetch(socketPath: string): typeof fetch {
  const dispatcher = new Agent({ connect: { socketPath } })

  return ((input: string | URL | Request, init?: RequestInit) =>
    undiciFetch(input as Parameters<typeof undiciFetch>[0], {
      ...(init as Parameters<typeof undiciFetch>[1]),
      dispatcher,
    })) as unknown as typeof fetch
}
