// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// GrafanaLink — the header's "Live metrics → Grafana" external link
// (design-spec §4, "Header bar: … 'Live metrics → Grafana' link"). Live CPU/RAM
// is explicitly out of scope here (§2.1, §8): the deployment's Grafana owns the
// live resource graphs; the console only LINKS to it. This is that link and
// nothing more — no embed, no fetch.
//
// The link opens in a new tab (`target="_blank"`) with
// `rel="noopener noreferrer"` so the opened Grafana tab cannot reach back into
// this console's window via `window.opener` (external-link safety).
//
// It is a presentational read-only-leaf component: `href` is a prop, it fetches
// nothing. It imports only React; the import-boundary rule pins it cannot reach
// a control-plane authority.

import type { ReactElement } from "react"

export function GrafanaLink({ href }: { href: string }): ReactElement {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-zinc-400 transition-colors hover:text-zinc-200"
    >
      Live metrics <span aria-hidden="true">&rarr;</span> Grafana
    </a>
  )
}
