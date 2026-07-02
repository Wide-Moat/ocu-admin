// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// The console's home route. It builds an HTTP read client pointed at this
// process's own BFF — which dials the control plane's read surface — gathers
// the Dashboard inputs through it, and feeds <Dashboard>.
//
// This file lives in the read zone (src/app): it imports only the read module
// (`@/lib/read`) and the read components, never a control-plane authority — the
// import-boundary rule (from-zone `^src/(app|components|lib/read)/` plus
// `^src/middleware\.ts$`) pins it.
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
//
// Because that hop carries the operator's session cookie, its destination is
// never derived from inbound headers: the read hop dials the process's own
// loopback listener (`http://127.0.0.1:${PORT}`), so no host / x-forwarded-*
// header a proxy passes through can steer where the cookie is sent. The
// inbound headers feed the cookie forwarding and nothing else.

import { headers } from "next/headers"

import { Dashboard } from "@/components/Dashboard"
import { createHttpReadClient } from "@/lib/read/client"
import { loadDashboardData } from "@/lib/read/dashboard-data"

// Placeholder until the deployment's real Grafana board URL is wired from
// config (the console only LINKS to Grafana; it never embeds it — §2.1, §8).
const GRAFANA_HREF = "https://grafana.example/d/ocu"

// The one thing the read hop takes from the inbound request: the session
// cookie to forward. No other inbound header is an input to the read path.
async function inboundCookie(): Promise<string | null> {
  const h = await headers()
  return h.get("cookie")
}

// The absolute base URL for the self-fetch: this process's own loopback
// listener, on the port it was told to listen on (PORT is read here, at
// request time, not at module load). The BFF routes are served by this same
// Next server, so the hop never leaves the process's own listener — plain
// http is correct (TLS terminates upstream), and no inbound header can steer
// where the operator's cookie is sent.
function loopbackBaseUrl(): string {
  return `http://127.0.0.1:${process.env.PORT ?? "3000"}`
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
  const cookie = await inboundCookie()
  const client = createHttpReadClient(loopbackBaseUrl(), {
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
