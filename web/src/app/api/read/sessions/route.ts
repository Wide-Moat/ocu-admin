// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// Mock BFF: GET /api/read/sessions — the enriched session list. It projects the
// fixture through the deterministic lifecycle simulation and returns EVERY
// session in the deployment as JSON (operator-sees-all per ADR-0022 — the
// console projects every session, with no per-tenant scoping of the read). The
// only knob is `?include_released`: present, released tombstones are surfaced;
// absent, only live rows are returned. This is a read-only all-GET leaf: it
// imports no control-plane authority (the import-boundary rule pins src/app/api
// away from src/lib/authority) and owns no mutable state.

import { projectSessionsAt } from "@/lib/read/lifecycle"
import { elapsedSinceEpoch } from "@/lib/read/mock-now"

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const includeReleased = url.searchParams.has("include_released")

  const projected = projectSessionsAt(elapsedSinceEpoch(), { includeReleased })

  return Response.json(projected)
}
