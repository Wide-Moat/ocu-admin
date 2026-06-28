// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// @vitest-environment jsdom

// DeploymentBadge renders the deployment-wide singletons as header badges
// (design-spec §4, "Header bar: … runtime_tier badge · runtime_provider").
// runtime_tier has a forward seam to a future per-row tier (§3, "Tier source")
// with no UI change — today it is the deployment singleton. The component is
// presentational: the DeploymentView is a prop, it fetches nothing. These tests
// drive it RED-first; they consume only the read-zone fixture/types.

import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, it, expect } from "vitest"
import "@testing-library/jest-dom/vitest"

afterEach(cleanup)

import { DeploymentBadge } from "../DeploymentBadge"
import { fixtureDeployment } from "@/lib/read/fixture"
import type { DeploymentView } from "@/lib/read/types"

describe("DeploymentBadge — over the fixture", () => {
  it("renders the runtime_tier text", () => {
    // fixtureDeployment is firecracker / docker.
    render(<DeploymentBadge deployment={fixtureDeployment} />)
    const tier = screen.getByTestId("deployment-tier")
    expect(tier).toHaveTextContent("firecracker")
  })

  it("renders the runtime_provider text", () => {
    render(<DeploymentBadge deployment={fixtureDeployment} />)
    const provider = screen.getByTestId("deployment-provider")
    expect(provider).toHaveTextContent("docker")
  })
})

describe("DeploymentBadge — over arbitrary tier/provider combos", () => {
  it("renders gvisor / k8s for a different deployment", () => {
    const deployment: DeploymentView = {
      runtime_tier: "gvisor",
      runtime_provider: "k8s",
    }
    render(<DeploymentBadge deployment={deployment} />)
    expect(screen.getByTestId("deployment-tier")).toHaveTextContent("gvisor")
    expect(screen.getByTestId("deployment-provider")).toHaveTextContent("k8s")
  })

  it("renders runc / docker", () => {
    const deployment: DeploymentView = {
      runtime_tier: "runc",
      runtime_provider: "docker",
    }
    render(<DeploymentBadge deployment={deployment} />)
    const badge = screen.getByTestId("deployment-badge")
    expect(within(badge).getByTestId("deployment-tier")).toHaveTextContent(
      "runc",
    )
    expect(within(badge).getByTestId("deployment-provider")).toHaveTextContent(
      "docker",
    )
  })
})
