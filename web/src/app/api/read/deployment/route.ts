// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// Mock BFF: GET /api/read/deployment — the deployment-wide singletons
// (runtime_tier, runtime_provider) as JSON. Read-only all-GET leaf; imports no
// control-plane authority.

import { fixtureDeployment } from "@/lib/read/fixture"

export async function GET(): Promise<Response> {
  return Response.json(fixtureDeployment)
}
