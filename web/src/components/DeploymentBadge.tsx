// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// DeploymentBadge — the header's deployment-wide singletons (design-spec §4,
// "Header bar: … runtime_tier badge · runtime_provider"). It renders the
// `runtime_tier` (runc / gvisor / firecracker) and `runtime_provider` (docker /
// k8s) as two small header badges.
//
// Tier source seam (§3, "Tier source, with a forward seam"): `runtime_tier` is
// a deployment-wide singleton today. NFR-SEC-38 allows mixed-tier per
// trust-profile later. The field is read as the `/deployment` singleton; its
// source can flip to a future per-row `tier` with NO UI change — this component
// renders whatever tier string it is handed.
//
// It is a presentational read-only-leaf component: the DeploymentView is a
// prop, it fetches nothing. It imports only the read zone (`@/lib/read`) and
// React; the import-boundary rule pins it cannot reach a control-plane
// authority. NOC styling matches SessionCard (zinc surfaces).

import type { ReactElement } from "react"

import type { DeploymentView } from "@/lib/read/types"

export function DeploymentBadge({
  deployment,
}: {
  deployment: DeploymentView
}): ReactElement {
  return (
    <div
      data-testid="deployment-badge"
      className="flex items-center gap-2 font-mono text-xs"
    >
      <span
        data-testid="deployment-tier"
        className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-zinc-200"
      >
        {deployment.runtime_tier}
      </span>
      <span
        data-testid="deployment-provider"
        className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-zinc-400"
      >
        {deployment.runtime_provider}
      </span>
    </div>
  )
}
