// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// @vitest-environment jsdom

// Dashboard assembles the read-only operator console (design-spec §4,
// "Dashboard layout"): a header bar (name · deployment badge · Grafana link ·
// logout), exactly two stats tiles, and a responsive grid of session cards —
// plus the honest 503/empty/loading states the spec requires. It is
// presentational: deployment / sessions / histogram / grafanaHref / now / state
// are props, it fetches nothing (page.tsx feeds the fixture today; phase 4 swaps
// the source with no change here). These tests drive the component RED-first;
// they consume the read-zone fixture/derive helpers, never a control-plane
// authority.

import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, it, expect } from "vitest"
import "@testing-library/jest-dom/vitest"

// Vitest runs without `globals`, so Testing Library's automatic afterEach
// cleanup is not wired in — unmount each render ourselves so a query never
// matches leftover DOM from a prior test.
afterEach(cleanup)

import { Dashboard } from "../Dashboard"
import {
  fixtureDeployment,
  fixtureSessions,
  fixtureStartHistogram,
} from "@/lib/read/fixture"
import { activeCount, stateLabel } from "@/lib/read/derive"

// A fixed clock so any age chips render deterministically.
const NOW = new Date("2026-06-27T06:48:52.000Z")
const GRAFANA = "https://grafana.example/d/ocu"

describe("Dashboard — header bar (state ok)", () => {
  it("renders the console name", () => {
    render(
      <Dashboard
        deployment={fixtureDeployment}
        sessions={fixtureSessions}
        histogram={fixtureStartHistogram}
        grafanaHref={GRAFANA}
        now={NOW}
        state="ok"
      />,
    )
    expect(
      screen.getByRole("heading", { name: /operator console/i }),
    ).toBeInTheDocument()
  })

  it("renders the deployment badge with tier and provider", () => {
    render(
      <Dashboard
        deployment={fixtureDeployment}
        sessions={fixtureSessions}
        histogram={fixtureStartHistogram}
        grafanaHref={GRAFANA}
        now={NOW}
        state="ok"
      />,
    )
    const badge = screen.getByTestId("deployment-badge")
    expect(within(badge).getByTestId("deployment-tier")).toHaveTextContent(
      fixtureDeployment.runtime_tier,
    )
    expect(within(badge).getByTestId("deployment-provider")).toHaveTextContent(
      fixtureDeployment.runtime_provider,
    )
  })

  it("renders the Grafana link pointing at the given href", () => {
    render(
      <Dashboard
        deployment={fixtureDeployment}
        sessions={fixtureSessions}
        histogram={fixtureStartHistogram}
        grafanaHref={GRAFANA}
        now={NOW}
        state="ok"
      />,
    )
    const link = screen.getByRole("link", { name: /grafana/i })
    expect(link).toHaveAttribute("href", GRAFANA)
  })

  it("renders a logout affordance pointing at the existing auth surface", () => {
    render(
      <Dashboard
        deployment={fixtureDeployment}
        sessions={fixtureSessions}
        histogram={fixtureStartHistogram}
        grafanaHref={GRAFANA}
        now={NOW}
        state="ok"
      />,
    )
    // A logout affordance exists and points at the existing /api/auth surface —
    // it wires no NEW mutating route, just a link to the auth ingress.
    const logout = screen.getByTestId("logout")
    expect(logout).toBeInTheDocument()
    expect(logout).toHaveAttribute("href", expect.stringContaining("/api/auth"))
  })
})

describe("Dashboard — stats tiles (state ok)", () => {
  it("renders exactly two stats tiles", () => {
    render(
      <Dashboard
        deployment={fixtureDeployment}
        sessions={fixtureSessions}
        histogram={fixtureStartHistogram}
        grafanaHref={GRAFANA}
        now={NOW}
        state="ok"
      />,
    )
    expect(screen.getAllByTestId("stat-tile")).toHaveLength(2)
  })

  it("shows the active-session count and the histogram-derived avg start", () => {
    render(
      <Dashboard
        deployment={fixtureDeployment}
        sessions={fixtureSessions}
        histogram={fixtureStartHistogram}
        grafanaHref={GRAFANA}
        now={NOW}
        state="ok"
      />,
    )
    expect(screen.getByTestId("stat-active-value")).toHaveTextContent(
      String(activeCount(fixtureSessions)),
    )
    // sum_seconds 78 / observation_count 12 = 6.5s, from the histogram.
    expect(screen.getByTestId("stat-avg-start-value")).toHaveTextContent("6.5")
  })
})

describe("Dashboard — sessions grid (state ok)", () => {
  it("renders one card per session", () => {
    render(
      <Dashboard
        deployment={fixtureDeployment}
        sessions={fixtureSessions}
        histogram={fixtureStartHistogram}
        grafanaHref={GRAFANA}
        now={NOW}
        state="ok"
      />,
    )
    expect(screen.getAllByTestId("session-card")).toHaveLength(
      fixtureSessions.length,
    )
  })

  it("renders the right lifecycle label for each fixture row", () => {
    render(
      <Dashboard
        deployment={fixtureDeployment}
        sessions={fixtureSessions}
        histogram={fixtureStartHistogram}
        grafanaHref={GRAFANA}
        now={NOW}
        state="ok"
      />,
    )
    // The fixture carries reserved / active / released; each maps to its UI
    // label and at least one card shows it.
    for (const session of fixtureSessions) {
      const label = stateLabel(session.state)
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1)
    }
    // Both active rows are Live; the reserved is Creating; the released is
    // Destroyed.
    expect(screen.getAllByText("Live")).toHaveLength(2)
    expect(screen.getAllByText("Creating")).toHaveLength(1)
    expect(screen.getAllByText("Destroyed")).toHaveLength(1)
  })

  it("passes the now prop through to the cards' age chips", () => {
    // sess-7f3a9c reserved 06:48:10, now 06:48:52 → 42s.
    render(
      <Dashboard
        deployment={fixtureDeployment}
        sessions={fixtureSessions}
        histogram={fixtureStartHistogram}
        grafanaHref={GRAFANA}
        now={NOW}
        state="ok"
      />,
    )
    expect(screen.getAllByText(/42s/).length).toBeGreaterThanOrEqual(1)
  })
})

describe("Dashboard — states", () => {
  it("state='unavailable' shows the control-plane-unavailable banner and no grid", () => {
    render(
      <Dashboard
        deployment={fixtureDeployment}
        sessions={fixtureSessions}
        histogram={fixtureStartHistogram}
        grafanaHref={GRAFANA}
        now={NOW}
        state="unavailable"
      />,
    )
    expect(screen.getByTestId("unavailable-banner")).toBeInTheDocument()
    expect(screen.getByText(/control plane unavailable/i)).toBeInTheDocument()
    // No session cards and no grid when the control plane is unavailable.
    expect(screen.queryAllByTestId("session-card")).toHaveLength(0)
    expect(screen.queryByTestId("sessions-grid")).not.toBeInTheDocument()
  })

  it("state='loading' shows a loading indicator and no grid", () => {
    render(
      <Dashboard
        deployment={fixtureDeployment}
        sessions={fixtureSessions}
        histogram={fixtureStartHistogram}
        grafanaHref={GRAFANA}
        now={NOW}
        state="loading"
      />,
    )
    expect(screen.getByTestId("loading-indicator")).toBeInTheDocument()
    expect(screen.queryAllByTestId("session-card")).toHaveLength(0)
  })

  it("empty sessions + state ok shows the 'No active sessions' empty state", () => {
    render(
      <Dashboard
        deployment={fixtureDeployment}
        sessions={[]}
        histogram={fixtureStartHistogram}
        grafanaHref={GRAFANA}
        now={NOW}
        state="ok"
      />,
    )
    expect(screen.getByTestId("empty-state")).toBeInTheDocument()
    expect(screen.getByText(/no active sessions/i)).toBeInTheDocument()
    expect(screen.queryAllByTestId("session-card")).toHaveLength(0)
  })

  it("defaults to ok state when no state prop is given", () => {
    render(
      <Dashboard
        deployment={fixtureDeployment}
        sessions={fixtureSessions}
        histogram={fixtureStartHistogram}
        grafanaHref={GRAFANA}
        now={NOW}
      />,
    )
    expect(screen.getAllByTestId("session-card")).toHaveLength(
      fixtureSessions.length,
    )
  })

  it("keeps the header (badge + stats) visible even when unavailable", () => {
    // The header and stats are the always-present chrome; only the grid region
    // swaps to the banner. The operator can still see the deployment + reach
    // Grafana / logout when the control plane is down.
    render(
      <Dashboard
        deployment={fixtureDeployment}
        sessions={fixtureSessions}
        histogram={fixtureStartHistogram}
        grafanaHref={GRAFANA}
        now={NOW}
        state="unavailable"
      />,
    )
    expect(screen.getByTestId("deployment-badge")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /grafana/i })).toBeInTheDocument()
    expect(screen.getByTestId("logout")).toBeInTheDocument()
  })
})
