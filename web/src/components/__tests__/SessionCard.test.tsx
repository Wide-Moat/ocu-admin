// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// @vitest-environment jsdom

// SessionCard renders ONE SessionView (design-spec §4, "Session card (the
// primitive)" + the lifecycle color table). It is presentational: it fetches
// nothing and polls nothing — it takes the row and a `now: Date` so the age
// chip renders deterministically in a test. These tests drive the component
// (written RED-first); they consume the read-zone fixture and types, never a
// control-plane authority.

import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, it, expect } from "vitest"
import "@testing-library/jest-dom/vitest"

// Vitest is configured without `globals`, so Testing Library's automatic
// afterEach cleanup is not wired in — unmount each render ourselves so a query
// never matches a leftover card from a prior test.
afterEach(cleanup)

import { SessionCard } from "../SessionCard"
import { fixtureSessions } from "@/lib/read/fixture"
import type { SessionView } from "@/lib/read/types"

const byKey = (key: string): SessionView =>
  fixtureSessions.find((s) => s.key === key)!

// A fixed clock so the age chip is deterministic.
const NOW = new Date("2026-06-27T06:48:52.000Z")

describe("SessionCard — reserved (Creating)", () => {
  const reserved = byKey("sess-7f3a9c") // caps/container/active_at all absent

  it("renders the 'Creating' label", () => {
    render(<SessionCard session={reserved} now={NOW} />)
    expect(screen.getByText("Creating")).toBeInTheDocument()
  })

  it("marks the status dot amber and pulsing", () => {
    render(<SessionCard session={reserved} now={NOW} />)
    const dot = screen.getByTestId("state-dot")
    // amber accent for the Creating state, with the Tailwind pulse animation.
    expect(dot.className).toMatch(/amber/)
    expect(dot.className).toContain("animate-pulse")
  })

  it("renders '—' for every absent cap and for container_name", () => {
    render(<SessionCard session={reserved} now={NOW} />)
    // CPU / RAM / PIDs are each shown as an em-dash while Creating.
    const cpu = screen.getByTestId("cap-cpu")
    const ram = screen.getByTestId("cap-ram")
    const pids = screen.getByTestId("cap-pids")
    expect(cpu).toHaveTextContent("—")
    expect(ram).toHaveTextContent("—")
    expect(pids).toHaveTextContent("—")
    expect(screen.getByTestId("container-name")).toHaveTextContent("—")
  })

  it("shows the key", () => {
    render(<SessionCard session={reserved} now={NOW} />)
    expect(screen.getByText("sess-7f3a9c")).toBeInTheDocument()
  })
})

describe("SessionCard — active (Live)", () => {
  const active = byKey("sess-2b81d4") // 2.0 cores, 4 GiB, 512 pids, ocu-sb-2b81d4

  it("renders the 'Live' label", () => {
    render(<SessionCard session={active} now={NOW} />)
    expect(screen.getByText("Live")).toBeInTheDocument()
  })

  it("marks the status dot emerald and NOT pulsing (steady)", () => {
    render(<SessionCard session={active} now={NOW} />)
    const dot = screen.getByTestId("state-dot")
    expect(dot.className).toMatch(/emerald/)
    expect(dot.className).not.toContain("animate-pulse")
  })

  it("renders the cap values: CPU cores, RAM in GiB, PIDs", () => {
    render(<SessionCard session={active} now={NOW} />)
    expect(screen.getByTestId("cap-cpu")).toHaveTextContent("2")
    // 4 GiB = 4 * 1024^3 bytes, shown in GiB.
    expect(screen.getByTestId("cap-ram")).toHaveTextContent("4")
    expect(screen.getByTestId("cap-ram")).toHaveTextContent("GiB")
    expect(screen.getByTestId("cap-pids")).toHaveTextContent("512")
  })

  it("renders the container_name", () => {
    render(<SessionCard session={active} now={NOW} />)
    expect(screen.getByTestId("container-name")).toHaveTextContent(
      "ocu-sb-2b81d4",
    )
  })

  it("renders the owner tenant and caller", () => {
    render(<SessionCard session={active} now={NOW} />)
    const owner = screen.getByTestId("owner")
    expect(within(owner).getByText(/acme/)).toBeInTheDocument()
    expect(within(owner).getByText(/api-bot/)).toBeInTheDocument()
  })
})

describe("SessionCard — released (Destroyed)", () => {
  const released = byKey("sess-1a05b7")

  it("renders the 'Destroyed' label", () => {
    render(<SessionCard session={released} now={NOW} />)
    expect(screen.getByText("Destroyed")).toBeInTheDocument()
  })

  it("marks the status dot zinc/muted and NOT pulsing (tombstone)", () => {
    render(<SessionCard session={released} now={NOW} />)
    const dot = screen.getByTestId("state-dot")
    expect(dot.className).toMatch(/zinc/)
    expect(dot.className).not.toContain("animate-pulse")
  })
})

describe("SessionCard — age chip", () => {
  it("shows formatAge(now − reserved_at) for a known reserved_at + now", () => {
    // reserved_at 06:48:10, now 06:48:52 → 42 seconds → "42s".
    const reserved = byKey("sess-7f3a9c")
    render(<SessionCard session={reserved} now={NOW} />)
    expect(screen.getByTestId("age-chip")).toHaveTextContent("42s")
  })

  it("renders a minute-scale age for a known offset", () => {
    const reserved = byKey("sess-7f3a9c") // reserved 06:48:10
    const now = new Date("2026-06-27T06:52:22.000Z") // +252s → "4m 12s"
    render(<SessionCard session={reserved} now={now} />)
    expect(screen.getByTestId("age-chip")).toHaveTextContent("4m 12s")
  })
})
