// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// BFF: GET /api/read/sessions — proxies the control operator socket's
// GET /v1alpha/sessions and returns EVERY session in the deployment as JSON
// (operator-sees-all per CONSTITUTION §8 / ADR-0022 — the console projects
// every session, with no per-tenant scoping of the read). The only knob is
// `?include_released`: present, it is forwarded to control so released
// tombstones are surfaced; absent, control returns live rows only. Read-only
// all-GET leaf; imports no control-plane authority.
//
// The client is built inside the handler so the socket path env is read per
// request, not at module load. Failure is never masked: a control non-2xx
// surfaces as its own status, and a transport failure (no socket, refused
// connection) surfaces as 503 — there is no fixture or default fallback.

import { createControlReadClient } from "@/lib/read/control-client"
import { ReadUnavailableError } from "@/lib/read/client"

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const includeReleased = url.searchParams.has("include_released")

  try {
    const client = createControlReadClient()
    const rows = await client.listSessions({ includeReleased })
    return Response.json(rows)
  } catch (err) {
    if (err instanceof ReadUnavailableError) {
      return new Response(null, { status: err.status })
    }
    return new Response(null, { status: 503 })
  }
}
