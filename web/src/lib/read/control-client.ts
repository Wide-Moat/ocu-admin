// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// The real ReadClient the route handlers use. It composes the three read-side
// pieces so the routes hold none of the transport: control-config resolves the
// operator socket path, uds-fetch dials it, and the existing createHttpReadClient
// applies the ADR-0022 contract (the four GETs, 404 -> null, non-2xx ->
// ReadUnavailableError, Prometheus-text parsing) on top. The base URL host is a
// throwaway — the request is dialed over the socket, not resolved by DNS — so it
// is a fixed sentinel, never a real hostname.
//
// Read-only leaf: it issues only GETs and imports no control-plane authority.

import { createHttpReadClient, type ReadClient } from "./client"
import { loadControlConfig } from "./control-config"
import { createUdsFetch } from "./uds-fetch"

// The socket ignores the URL host; this sentinel only has to be a valid origin.
const CONTROL_ORIGIN = "http://control"

type Env = Record<string, string | undefined>

/**
 * Build the ReadClient pinned to the control operator socket. Reads the socket
 * path from `env` (OCU_ADMIN_CONTROL_SOCKET, default the fleet convention),
 * dials it over a Unix-domain socket, and returns a fully-typed ReadClient.
 */
export function createControlReadClient(env: Env = process.env): ReadClient {
  const { socketPath } = loadControlConfig(env)
  return createHttpReadClient(CONTROL_ORIGIN, {
    fetch: createUdsFetch(socketPath),
  })
}
