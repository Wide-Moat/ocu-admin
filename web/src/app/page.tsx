// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// The console's home route — the fixture→real seam (design-spec §5,
// "Mock-first, flip per-endpoint"). It feeds the Dashboard from the checked-in
// read fixture today; phase 4 swaps the data source HERE (the BFF read client
// replaces these imports) with NO change to Dashboard or the cards below it.
//
// This file lives in the read zone (src/app): it imports only the read module
// (`@/lib/read`) and the read components, never a control-plane authority — the
// import-boundary rule (dependency-cruiser `^src/(app/api|lib/read|components)`)
// pins the components, and this page reaches no authority regardless.
//
// `now` is computed once per render request (server component); the cards derive
// their age chips from it. `state="ok"` because the fixture is always present;
// the loading / unavailable surfaces are exercised once the real BFF can report
// a 503 / pre-data state.

import { Dashboard } from "@/components/Dashboard"
import {
  fixtureDeployment,
  fixtureSessions,
  fixtureStartHistogram,
} from "@/lib/read/fixture"

// Placeholder until the deployment's real Grafana board URL is wired from
// config (the console only LINKS to Grafana; it never embeds it — §2.1, §8).
const GRAFANA_HREF = "https://grafana.example/d/ocu"

export default function Home() {
  return (
    <Dashboard
      deployment={fixtureDeployment}
      sessions={fixtureSessions}
      histogram={fixtureStartHistogram}
      grafanaHref={GRAFANA_HREF}
      now={new Date()}
      state="ok"
    />
  )
}
