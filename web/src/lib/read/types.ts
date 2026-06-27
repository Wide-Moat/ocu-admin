// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// Read-surface view types for the ocu-admin operator console.
//
// These mirror the drafted ADR-0022 read contract (design spec §3) field for
// field. The shape is NOT frozen — ADR-0022 is `status: proposed`, unmerged —
// so these types exist only to design the fixture-fed dashboard against; they
// are not generated from the draft and invent no field beyond it (spec §4,
// "never invented data"). When ADR-0022 ratifies on `next/v1`, the generated
// types replace this file and the fixture is checked against them.
//
// The read module is a read-only leaf: nothing here imports a control-plane
// authority (denylist / quota / lifecycle). The import-boundary rule pins it.

/**
 * Sandbox session lifecycle state. Lowercase, exact — these literal strings are
 * the canon wire values, mapped to UI labels (reserved→Creating, active→Live,
 * released→Destroyed) only at the view layer, never on the wire.
 */
export type SessionState = "reserved" | "active" | "released"

/**
 * Resource caps a session was given. Activation enrichment: absent until the row
 * reaches `active`. memory_bytes and pids_limit are integer counts;
 * cpu_cores is fractional. All are hard ceilings (exclusiveMinimum 0 in the
 * draft schema).
 */
export type SessionCaps = {
  cpu_cores: number // fractional cores
  memory_bytes: number // integer (bytes)
  pids_limit?: number // integer (process-count cap)
}

/**
 * A single projected session row. `session_key`, `owner`, `state`, and
 * `reserved_at` are always present; `container_name`, `caps`, and `active_at`
 * are read-surface/audit-derived activation enrichment, absent until the row
 * reaches `active`.
 */
export type SessionView = {
  session_key: string // canon name (host-derived reservation key)
  // Owner attribution from the audit/host-side projection — NOT the lifecycle
  // handle, which carries no owner (caller identity is host-attested from the
  // operator transport's peer credential, never a body field).
  owner: { tenant: string; caller: string }
  state: SessionState
  container_name?: string // bound after activation; absent until then
  caps?: SessionCaps // activation enrichment; absent until active
  reserved_at: string // ISO; ALWAYS present
  active_at?: string // ISO; absent until the row reaches active
}

/**
 * Deployment-wide singletons. Rendered as header badges. `runtime_tier` has a
 * forward seam to a future per-row tier (NFR-SEC-38) with no UI change.
 */
export type DeploymentView = {
  runtime_tier: "runc" | "gvisor" | "firecracker"
  runtime_provider: "docker" | "k8s"
}

/**
 * The parsed reserved→active duration histogram from the `/metrics` exposition.
 * The BFF parses the Prometheus text into this shape; the average start time is
 * derived as `sum_seconds / observation_count` — never from one row's
 * `active_at − reserved_at` (spec §3, "derived values, never from a row").
 *
 * Each bucket is cumulative: `cumulative_count` is every observation whose value
 * is ≤ `le` (the bucket's upper bound, in seconds). Buckets ascend by `le`; the
 * terminal bucket's count equals `observation_count`.
 */
export type StartHistogram = {
  buckets: { le: number; cumulative_count: number }[] // cumulative, le ascending
  sum_seconds: number // _sum: total observed duration (seconds)
  observation_count: number // _count: total observations (== terminal bucket)
}
