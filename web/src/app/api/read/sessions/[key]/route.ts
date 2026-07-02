// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// BFF: GET /api/read/sessions/[key] — proxies the control operator socket's
// GET /v1alpha/sessions/{key} and returns the single session as JSON, or 404
// when control holds no row for the key. The lookup runs over EVERY session in
// the deployment (operator-sees-all per CONSTITUTION §8 / ADR-0022); a 404
// means the key does not exist, period. The key is URL-encoded before it
// reaches the wire, so it stays one path segment. Read-only all-GET leaf;
// imports no control-plane authority.
//
// The client is built inside the handler so the socket path env is read per
// request, not at module load. Failure is never masked: a control non-2xx
// surfaces as its own status, and a transport failure (no socket, refused
// connection) surfaces as 503 — there is no fixture or default fallback, and a
// dead control plane never masquerades as a missing session.

import { createControlReadClient } from "@/lib/read/control-client"
import { ReadUnavailableError } from "@/lib/read/client"

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> },
): Promise<Response> {
  const { key } = await context.params

  try {
    const client = createControlReadClient()
    const row = await client.getSession(key)
    if (row === null) {
      return new Response(null, { status: 404 })
    }
    return Response.json(row)
  } catch (err) {
    if (err instanceof ReadUnavailableError) {
      return new Response(null, { status: err.status })
    }
    return new Response(null, { status: 503 })
  }
}
