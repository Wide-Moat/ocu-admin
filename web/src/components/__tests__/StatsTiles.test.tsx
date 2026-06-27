// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// @vitest-environment jsdom

// StatsTiles renders the dashboard's two summary stats (design-spec §4,
// "Stats tiles (exactly two, per canon)"): Active sessions (count of
// state==='active') and Avg start time (from the /metrics histogram, never a
// row). It is presentational: sessions + histogram are props, it fetches
// nothing. These tests drive the component RED-first; they consume the
// read-zone fixture/derive helpers, never a control-plane authority.

import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, it, expect } from "vitest"
import "@testing-library/jest-dom/vitest"

// Vitest runs without `globals`, so Testing Library's automatic afterEach
// cleanup is not wired in — unmount each render ourselves so a query never
// matches a leftover tile from a prior test.
afterEach(cleanup)

import { StatsTiles } from "../StatsTiles"
import { fixtureSessions, fixtureStartHistogram } from "@/lib/read/fixture"
import { activeCount, avgStartSeconds } from "@/lib/read/derive"
import type { SessionView, StartHistogram } from "@/lib/read/types"

describe("StatsTiles — over the fixture", () => {
  it("renders exactly two tiles", () => {
    render(
      <StatsTiles
        sessions={fixtureSessions}
        histogram={fixtureStartHistogram}
      />,
    )
    expect(screen.getAllByTestId("stat-tile")).toHaveLength(2)
  })

  it("shows the active-session count (state==='active')", () => {
    // The fixture has two `active` rows (a reserved + a released are excluded).
    const expected = activeCount(fixtureSessions)
    expect(expected).toBe(2)
    render(
      <StatsTiles
        sessions={fixtureSessions}
        histogram={fixtureStartHistogram}
      />,
    )
    const tile = screen.getByTestId("stat-active")
    expect(within(tile).getByText(/Active sessions/i)).toBeInTheDocument()
    expect(within(tile).getByTestId("stat-active-value")).toHaveTextContent(
      String(expected),
    )
  })

  it("shows a formatted avg-start derived from the histogram (6.5s)", () => {
    // sum_seconds 78 / observation_count 12 = 6.5 seconds.
    expect(avgStartSeconds(fixtureStartHistogram)).toBe(6.5)
    render(
      <StatsTiles
        sessions={fixtureSessions}
        histogram={fixtureStartHistogram}
      />,
    )
    const tile = screen.getByTestId("stat-avg-start")
    expect(within(tile).getByText(/Avg start time/i)).toBeInTheDocument()
    // The value carries the seconds figure and a seconds unit.
    const value = within(tile).getByTestId("stat-avg-start-value")
    expect(value).toHaveTextContent("6.5")
    expect(value).toHaveTextContent("s")
  })
})

describe("StatsTiles — active count edge cases", () => {
  it("renders 0 active on an empty session list", () => {
    render(<StatsTiles sessions={[]} histogram={fixtureStartHistogram} />)
    expect(screen.getByTestId("stat-active-value")).toHaveTextContent("0")
  })

  it("renders 0 active when no row is in the active state", () => {
    const noneActive: SessionView[] = fixtureSessions.filter(
      (s) => s.state !== "active",
    )
    render(
      <StatsTiles sessions={noneActive} histogram={fixtureStartHistogram} />,
    )
    expect(screen.getByTestId("stat-active-value")).toHaveTextContent("0")
  })
})

describe("StatsTiles — avg-start comes from the histogram, not a row", () => {
  it("ignores a row's active_at when computing avg start time", () => {
    // A single active row whose active_at − reserved_at is a huge 3600s. If the
    // tile derived avg-start from rows it would read 3600s; it must read the
    // histogram's 6.5s instead.
    const rowWithSlowStart: SessionView[] = [
      {
        session_key: "sess-slow",
        owner: { tenant: "acme", caller: "api-bot" },
        state: "active",
        container_name: "ocu-sb-slow",
        caps: {
          cpu_cores: 1.0,
          memory_bytes: 1 * 1024 * 1024 * 1024,
          pids_limit: 256,
        },
        reserved_at: "2026-06-27T06:00:00.000Z",
        active_at: "2026-06-27T07:00:00.000Z", // +3600s
      },
    ]
    render(
      <StatsTiles
        sessions={rowWithSlowStart}
        histogram={fixtureStartHistogram}
      />,
    )
    const value = screen.getByTestId("stat-avg-start-value")
    expect(value).toHaveTextContent("6.5")
    expect(value).not.toHaveTextContent("3600")
  })

  it("renders the avg from a different histogram (12 / 3 = 4.0s)", () => {
    const histogram: StartHistogram = {
      buckets: [{ le: 30.0, cumulative_count: 3 }],
      sum_seconds: 12,
      observation_count: 3,
    }
    render(<StatsTiles sessions={[]} histogram={histogram} />)
    expect(screen.getByTestId("stat-avg-start-value")).toHaveTextContent("4")
  })
})
