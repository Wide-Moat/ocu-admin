// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// The console's home route. It builds an HTTP read client pointed at this
// origin's BFF (`/api/read/*`) — which dials the control plane's read
// surface — gathers the Dashboard inputs through it, and feeds <Dashboard>.
//
// This file lives in the read zone (src/app): it imports only the read module
// (`@/lib/read`) and the read components, never a control-plane authority — the
// import-boundary rule (`^src/(app/api|lib/read|components)`) pins it.
//
// State mapping (§3, §4): loadDashboardData reports state="unavailable" on a
// ReadUnavailableError (the 503 / BoundedReason path), which becomes
// <Dashboard state="unavailable">; otherwise state="ok". `now` is computed once
// per render request (server component); the cards derive their age chips from
// it. When the read is down `deployment` is null and passes through as-is:
// the badge renders honest "—" placeholders — nothing falls back to a fixture
// or any other invented value.
//
// Auth seam: the read paths (`/v1alpha/*`, `/metrics`) sit behind the same
// session gate as the page itself, and a server component's fetch to its own
// origin is a fresh request carrying no cookie of its own. The page therefore
// forwards the inbound request's cookie header on every read it issues;
// without it every SSR read is answered 401 and the dashboard renders
// permanently "unavailable" even for a logged-in operator.

import { headers } from "next/headers"

import { Dashboard } from "@/components/Dashboard"
import { createHttpReadClient } from "@/lib/read/client"
import { loadDashboardData } from "@/lib/read/dashboard-data"

// Placeholder until the deployment's real Grafana board URL is wired from
// config (the console only LINKS to Grafana; it never embeds it — §2.1, §8).
const GRAFANA_HREF = "https://grafana.example/d/ocu"

// Read the inbound request's headers once: the absolute same-origin base URL
// for the in-deployment BFF (a server component must dial an absolute URL; the
// request's host/proto headers give it) and the session cookie to forward.
async function inboundRequest(): Promise<{
  baseUrl: string
  cookie: string | null
}> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? "http"
  return { baseUrl: `${proto}://${host}`, cookie: h.get("cookie") }
}

// A fetch that carries the forwarded cookie on every request, merged over any
// init headers. With no inbound cookie there is nothing to forward, so the
// global fetch is used as-is (and no `cookie: "null"` artifact is ever sent).
function withForwardedCookie(cookie: string | null): typeof fetch {
  if (cookie === null) {
    return fetch
  }
  return (input, init) => {
    const requestHeaders = new Headers(init?.headers)
    requestHeaders.set("cookie", cookie)
    return fetch(input, { ...init, headers: requestHeaders })
  }
}

export default async function Home() {
  const { baseUrl, cookie } = await inboundRequest()
  const client = createHttpReadClient(baseUrl, {
    fetch: withForwardedCookie(cookie),
  })
  const data = await loadDashboardData(client)

  return (
    <Dashboard
      deployment={data.deployment}
      sessions={data.sessions}
      histogram={data.histogram}
      grafanaHref={GRAFANA_HREF}
      now={new Date()}
      state={data.state}
    />
  )
}
