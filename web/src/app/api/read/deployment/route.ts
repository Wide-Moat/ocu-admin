// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// BFF: GET /api/read/deployment — proxies the control operator socket's
// GET /v1alpha/deployment and returns the deployment-wide singletons
// (runtime_tier, runtime_provider) as JSON. Read-only all-GET leaf; imports no
// control-plane authority.
//
// The client is built inside the handler so the socket path env is read per
// request, not at module load. Failure is never masked: a control non-2xx
// surfaces as its own status, and a transport failure (no socket, refused
// connection) surfaces as 503 — there is no fixture or default fallback.

import { createControlReadClient } from "@/lib/read/control-client"
import { ReadUnavailableError } from "@/lib/read/client"

export async function GET(): Promise<Response> {
  try {
    const client = createControlReadClient()
    const dep = await client.getDeployment()
    return Response.json(dep)
  } catch (err) {
    if (err instanceof ReadUnavailableError) {
      return new Response(null, { status: err.status })
    }
    return new Response(null, { status: 503 })
  }
}
