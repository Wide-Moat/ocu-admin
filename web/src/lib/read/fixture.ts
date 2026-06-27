// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// Seeded read-surface fixture for the ocu-admin operator console.
//
// This is the ONLY data source until ADR-0022 ratifies (spec §2.5, "no invented
// data, never ahead of canon"): type generation and the real BFF are blocked
// until the contract is `status: accepted` on `next/v1`. These rows exercise
// every lifecycle state honestly so the dashboard's empty/absent rendering ("—"
// while Creating) is proven against real-shaped data, not a happy path.
//
// All values are realistic but clearly fake (no real secrets, no real hosts).
// The read module is a read-only leaf: this file imports only read types.

import type { DeploymentView, SessionView, StartHistogram } from "./types"

/**
 * Deployment-wide singletons. firecracker / docker — one of the allowed
 * tier/provider enums.
 */
export const fixtureDeployment: DeploymentView = {
  runtime_tier: "firecracker",
  runtime_provider: "docker",
}

/**
 * One row of every lifecycle state.
 *
 * - `reserved` (Creating): caps, container_name, active_at all ABSENT — only the
 *   always-present fields are set. Proves the card renders "—" gracefully.
 * - `active` (Live): caps present (fractional cpu_cores, integer memory_bytes +
 *   pids_limit), container_name present, active_at present.
 * - `released` (Destroyed): a tombstone, only surfaced with `?include_released`.
 */
export const fixtureSessions: SessionView[] = [
  {
    // Creating: reserved but not yet activated — no caps, no container, no
    // active_at. The absent-until-active invariant in row form.
    session_key: "sess-7f3a9c",
    owner: { tenant: "acme", caller: "api-bot" },
    state: "reserved",
    reserved_at: "2026-06-27T06:48:10.000Z",
  },
  {
    // Live: fully enriched. 4 GiB = 4 * 1024^3 bytes, an exact integer.
    session_key: "sess-2b81d4",
    owner: { tenant: "acme", caller: "api-bot" },
    state: "active",
    container_name: "ocu-sb-2b81d4",
    caps: {
      cpu_cores: 2.0, // fractional cores (here a whole 2.0)
      memory_bytes: 4 * 1024 * 1024 * 1024, // 4 GiB, integer bytes
      pids_limit: 512, // integer process-count cap
    },
    reserved_at: "2026-06-27T06:45:02.000Z",
    active_at: "2026-06-27T06:45:09.000Z",
  },
  {
    // A second Live row with a different tenant and a fractional core, so the
    // grid renders more than one enriched card and a non-integer cpu_cores.
    session_key: "sess-9d40e1",
    owner: { tenant: "globex", caller: "scheduler" },
    state: "active",
    container_name: "ocu-sb-9d40e1",
    caps: {
      cpu_cores: 0.5, // fractional core
      memory_bytes: 2 * 1024 * 1024 * 1024, // 2 GiB, integer bytes
      pids_limit: 256,
    },
    reserved_at: "2026-06-27T06:40:33.000Z",
    active_at: "2026-06-27T06:40:41.000Z",
  },
  {
    // Destroyed: a tombstone. Carried active_at while it lived; the read surface
    // keeps the historical timestamps on the released row.
    session_key: "sess-1a05b7",
    owner: { tenant: "initech", caller: "api-bot" },
    state: "released",
    container_name: "ocu-sb-1a05b7",
    caps: {
      cpu_cores: 1.0,
      memory_bytes: 1 * 1024 * 1024 * 1024, // 1 GiB, integer bytes
      pids_limit: 256,
    },
    reserved_at: "2026-06-27T06:10:00.000Z",
    active_at: "2026-06-27T06:10:06.000Z",
  },
]

/**
 * A `/metrics`-style reserved→active duration histogram, already parsed into the
 * shape the BFF would emit. Cumulative buckets (le ascending, count
 * non-decreasing), plus the Prometheus `_sum` and `_count`. The average start
 * time is `sum_seconds / observation_count` — T2 derives it from this, never
 * from a row.
 *
 * Twelve observations: a sum of 78 seconds over 12 starts → a 6.5s average.
 */
export const fixtureStartHistogram: StartHistogram = {
  buckets: [
    { le: 2.5, cumulative_count: 1 },
    { le: 5.0, cumulative_count: 5 },
    { le: 7.5, cumulative_count: 9 },
    { le: 10.0, cumulative_count: 11 },
    { le: 30.0, cumulative_count: 12 },
  ],
  sum_seconds: 78,
  observation_count: 12,
}
