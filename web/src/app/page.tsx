// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// The console's home route — the fixture→real seam, now flipped to the mock BFF
// read client (design-spec §5, "Mock-first, flip per-endpoint"). It no longer
// imports the fixture directly: it builds an HTTP read client pointed at this
// origin's mock BFF (`/api/read/*`), gathers the Dashboard inputs through it,
// and feeds <Dashboard> — with NO change to Dashboard or the cards below it.
// When the real BFF lands, only the base URL changes; this seam stays.
//
// This file lives in the read zone (src/app): it imports only the read module
// (`@/lib/read`) and the read components, never a control-plane authority — the
// import-boundary rule (`^src/(app/api|lib/read|components)`) pins it.
//
// State mapping (§3, §4): loadDashboardData reports state="unavailable" on a
// ReadUnavailableError (the 503 / BoundedReason path), which becomes
// <Dashboard state="unavailable">; otherwise state="ok". `now` is computed once
// per render request (server component); the cards derive their age chips from
// it. Deployment singletons are the BFF's own config fact, so the badge falls
// back to the fixture deployment when the session read is down.

import { headers } from "next/headers"

import { Dashboard } from "@/components/Dashboard"
import { createHttpReadClient } from "@/lib/read/client"
import { loadDashboardData } from "@/lib/read/dashboard-data"
import { fixtureDeployment } from "@/lib/read/fixture"

// Placeholder until the deployment's real Grafana board URL is wired from
// config (the console only LINKS to Grafana; it never embeds it — §2.1, §8).
const GRAFANA_HREF = "https://grafana.example/d/ocu"

// Build the absolute same-origin base URL for the in-deployment BFF. A server
// component must dial an absolute URL; the request's host/proto headers give it.
async function originBaseUrl(): Promise<string> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? "http"
  return `${proto}://${host}`
}

export default async function Home() {
  const client = createHttpReadClient(await originBaseUrl())
  const data = await loadDashboardData(client)

  return (
    <Dashboard
      deployment={data.deployment ?? fixtureDeployment}
      sessions={data.sessions}
      histogram={data.histogram}
      grafanaHref={GRAFANA_HREF}
      now={new Date()}
      state={data.state}
    />
  )
}
