// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// Dashboard — the read-only operator console layout (design-spec §4, "Dashboard
// layout"). It assembles the leaf primitives into one screen:
//
//   - Header bar: console name · DeploymentBadge (runtime_tier · provider) ·
//     GrafanaLink ("Live metrics → Grafana") · a logout affordance that POSTs to
//     the auth-substrate's clear-cookie route (`/api/auth/logout`), which drops
//     the session cookie. This is the console's only auth write; it touches no
//     control-plane state.
//   - StatsTiles: exactly the two summary stats (Active sessions · Avg start
//     time), derived from sessions + the /metrics histogram.
//   - Sessions grid: one SessionCard per row, in a responsive Tailwind grid,
//     ages computed from the `now` prop so the screen renders deterministically.
//
// Honest non-happy-path states (design-spec §4, "States"): the `state` prop
// selects what fills the grid region —
//   - "unavailable": a "Control plane unavailable" banner (the 503 /
//     BoundedReason surface, §3 "503 = Denied"), no grid.
//   - "loading": a loading indicator (a later phase polls; here it is the
//     pre-data state).
//   - "ok" + no sessions: a "No active sessions" empty state.
// The header chrome (badge · Grafana · logout) and the stats stay visible across
// all states, so an operator can still read the deployment and reach Grafana /
// logout when the control plane is down.
//
// It is a presentational read-only-leaf component: deployment / sessions /
// histogram / grafanaHref / now / state are all props — it fetches nothing.
// page.tsx feeds the fixture today; phase 4 swaps the data source at that seam
// with NO change here. It imports only the read zone (`@/lib/read`), its sibling
// read components, and React; the import-boundary rule pins that it cannot reach
// a control-plane authority.
//
// TODO (design-spec §4): a "Show destroyed" filter chip toggling
// `?include_released` — released tombstones are presently rendered when present
// in `sessions` (the caller decides what to pass). The toggle is deferred to the
// phase that owns the BFF query param; it is not wired here to avoid inventing a
// query seam ahead of the real read client.

import type { ReactElement } from "react"

import { DeploymentBadge } from "./DeploymentBadge"
import { GrafanaLink } from "./GrafanaLink"
import { SessionCard } from "./SessionCard"
import { StatsTiles } from "./StatsTiles"
import type {
  DeploymentView,
  SessionView,
  StartHistogram,
} from "@/lib/read/types"

/**
 * The dashboard's read state. `ok` renders the grid (or the empty state);
 * `loading` is the pre-data state; `unavailable` is the 503 / BoundedReason
 * surface (§3, "503 = Denied"). It is a view concern only — the read surface
 * tells the BFF which one to pass; nothing here mutates control-plane state.
 */
export type DashboardState = "ok" | "loading" | "unavailable"

// Where the logout affordance POSTs: the auth-substrate's clear-cookie route.
// It drops the session cookie and returns 204; it reads no control-plane state.
const LOGOUT_ACTION = "/api/auth/logout"

export function Dashboard({
  deployment,
  sessions,
  histogram,
  grafanaHref,
  now,
  state = "ok",
}: {
  deployment: DeploymentView
  sessions: SessionView[]
  histogram: StartHistogram
  grafanaHref: string
  now: Date
  state?: DashboardState
}): ReactElement {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-8">
      {/* Header bar: name · deployment badge · Grafana link · logout. */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            OCU Operator Console
          </h1>
          <DeploymentBadge deployment={deployment} />
        </div>
        <div className="flex items-center gap-4">
          <GrafanaLink href={grafanaHref} />
          {/* Logout POSTs to the clear-cookie route; a form (not a link) so a
              prefetch or cross-site GET cannot silently end the session. */}
          <form method="POST" action={LOGOUT_ACTION}>
            <button
              data-testid="logout"
              type="submit"
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      {/* The two summary stats — always visible chrome. */}
      <StatsTiles sessions={sessions} histogram={histogram} />

      {/* The grid region: one of banner / loading / empty / cards. */}
      <SessionsRegion sessions={sessions} now={now} state={state} />
    </main>
  )
}

/**
 * The swappable grid region. The `state` prop selects the honest non-happy-path
 * surface (design-spec §4, "States"); only `ok` with a non-empty list renders
 * the card grid.
 */
function SessionsRegion({
  sessions,
  now,
  state,
}: {
  sessions: SessionView[]
  now: Date
  state: DashboardState
}): ReactElement {
  if (state === "unavailable") {
    // §3 "503 = Denied": a BoundedReason envelope surfaces here as a banner,
    // never a crash.
    return (
      <div
        data-testid="unavailable-banner"
        role="alert"
        className="rounded-lg border border-amber-900/60 bg-amber-950/30 px-4 py-6 text-center text-amber-200"
      >
        <p className="font-medium">Control plane unavailable</p>
        <p className="mt-1 text-sm text-amber-200/70">
          The deployment&rsquo;s control plane is not reachable or is busy. This
          is a read-only console; retry, or use the CLI / GitOps path.
        </p>
      </div>
    )
  }

  if (state === "loading") {
    return (
      <div
        data-testid="loading-indicator"
        role="status"
        aria-live="polite"
        className="flex flex-col gap-3"
      >
        <span className="text-sm text-zinc-500">Loading sessions&hellip;</span>
        {/* A light skeleton row — muted placeholders, no data implied. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              data-testid="session-skeleton"
              aria-hidden="true"
              className="h-40 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900"
            />
          ))}
        </div>
      </div>
    )
  }

  // state === "ok"
  if (sessions.length === 0) {
    return (
      <div
        data-testid="empty-state"
        className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-10 text-center text-zinc-400"
      >
        <p className="font-medium text-zinc-300">No active sessions</p>
        <p className="mt-1 text-sm text-zinc-500">
          The deployment has no sessions to show.
        </p>
      </div>
    )
  }

  return (
    <div
      data-testid="sessions-grid"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {sessions.map((session) => (
        <SessionCard key={session.key} session={session} now={now} />
      ))}
    </div>
  )
}
