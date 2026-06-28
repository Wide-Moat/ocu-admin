// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// Mock BFF: GET /api/read/sessions/[key] — a single projected session, or 404.
// Read-only all-GET leaf; imports no control-plane authority. The lookup runs
// over EVERY session in the deployment (operator-sees-all per ADR-0022); a 404
// means the key does not exist, period.

import { projectSessionsAt } from "@/lib/read/lifecycle"
import { elapsedSinceEpoch } from "@/lib/read/mock-now"

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> },
): Promise<Response> {
  const { key } = await context.params

  // Include released so a tombstone is addressable by key.
  const projected = projectSessionsAt(elapsedSinceEpoch(), {
    includeReleased: true,
  })
  const row = projected.find((s) => s.key === key)

  if (row === undefined) {
    return new Response(null, { status: 404 })
  }
  return Response.json(row)
}
