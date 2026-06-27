// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// @vitest-environment jsdom

// GrafanaLink renders the header's "Live metrics → Grafana" external link
// (design-spec §4, "Header bar: … 'Live metrics → Grafana' link"). Live CPU/RAM
// is out of scope — Grafana owns it; the console only links to it (§2.1). The
// href is a prop, it fetches nothing. The link opens in a new tab with
// rel="noopener noreferrer" for external-link safety. These tests drive it
// RED-first.

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, it, expect } from "vitest"
import "@testing-library/jest-dom/vitest"

afterEach(cleanup)

import { GrafanaLink } from "../GrafanaLink"

const HREF = "https://grafana.example.test/d/ocu/sessions"

describe("GrafanaLink", () => {
  it("renders an <a> carrying the given href", () => {
    render(<GrafanaLink href={HREF} />)
    const link = screen.getByRole("link")
    expect(link).toHaveAttribute("href", HREF)
  })

  it("renders the 'Live metrics' / Grafana label", () => {
    render(<GrafanaLink href={HREF} />)
    const link = screen.getByRole("link")
    expect(link).toHaveTextContent(/Live metrics/i)
    expect(link).toHaveTextContent(/Grafana/i)
  })

  it("opens in a new tab with external-link-safe rel", () => {
    render(<GrafanaLink href={HREF} />)
    const link = screen.getByRole("link")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("carries whatever href it is given", () => {
    const other = "https://metrics.internal.test/grafana"
    render(<GrafanaLink href={other} />)
    expect(screen.getByRole("link")).toHaveAttribute("href", other)
  })
})
