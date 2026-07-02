// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// The page's data seam. It gathers the three Dashboard inputs (deployment,
// sessions, histogram) through a ReadClient and reports the Dashboard state.
// page.tsx calls this with an HTTP client pointed at its own origin's BFF,
// which dials the control plane's read surface; the dashboard component stays
// a pure presentational leaf fed by props.
//
// The 503 / BoundedReason path: a ReadUnavailableError (a non-2xx from the read
// surface) is caught and reported as state="unavailable" with safe empty inputs,
// which page.tsx maps straight to <Dashboard state="unavailable">. ANY other
// error is re-thrown — a real bug is never silently swallowed into the
// unavailable banner.

import { ReadUnavailableError, type ReadClient } from "./client"
import type { DeploymentView, SessionView, StartHistogram } from "./types"

const EMPTY_HISTOGRAM: StartHistogram = {
  buckets: [],
  sum_seconds: 0,
  observation_count: 0,
}

/**
 * The Dashboard's resolved data plus its state. `ok` carries the real
 * projection; `unavailable` carries safe empty inputs so the header chrome and
 * the stat tiles still render when the read surface is down — the tiles then
 * show "—" placeholders, never these empty inputs' zeros as fact.
 */
export type DashboardData = {
  state: "ok" | "unavailable"
  deployment: DeploymentView | null
  sessions: SessionView[]
  histogram: StartHistogram
}

/**
 * Gather the Dashboard inputs through `client`. Returns state="ok" with the
 * projection on success; on a ReadUnavailableError returns state="unavailable"
 * with empty inputs. A non-ReadUnavailable error propagates.
 */
export async function loadDashboardData(
  client: ReadClient,
): Promise<DashboardData> {
  try {
    const [deployment, sessions, histogram] = await Promise.all([
      client.getDeployment(),
      client.listSessions(),
      client.getMetrics(),
    ])
    return { state: "ok", deployment, sessions, histogram }
  } catch (err) {
    if (err instanceof ReadUnavailableError) {
      return {
        state: "unavailable",
        deployment: null,
        sessions: [],
        histogram: EMPTY_HISTOGRAM,
      }
    }
    throw err
  }
}
