// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// SessionCard — the dashboard primitive (design-spec §4, "Session card").
//
// It renders ONE projected SessionView: a lifecycle state badge, the
// `session_key` in mono, an age chip, the owner, the resource caps, and the
// container name. It is a presentational read-only-leaf component — it fetches
// nothing and polls nothing (that's a later phase); the row and the clock
// (`now: Date`) are props, so the age renders identically in a test and at
// runtime. It imports only the read zone (`@/lib/read`) and React; the
// import-boundary rule pins that it cannot reach a control-plane authority.

import type { ReactElement } from "react"

import { ageSeconds, formatAge, stateLabel } from "@/lib/read/derive"
import type { SessionState, SessionView } from "@/lib/read/types"

/**
 * Per-state accent + motion (design-spec §4 lifecycle color table):
 * `reserved`→amber + pulsing dot (being built), `active`→emerald steady glow,
 * `released`→zinc muted tombstone (no pulse). The accent is the one hue the
 * card carries; everything else is the neutral NOC surface.
 */
const STATE_STYLE: Record<
  SessionState,
  { dot: string; label: string; dim: boolean }
> = {
  reserved: {
    // amber, pulsing (animate-pulse) — the session is still being built.
    dot: "bg-amber-400 shadow-[0_0_6px] shadow-amber-400/60 animate-pulse",
    label: "text-amber-300",
    dim: false,
  },
  active: {
    // emerald, steady glow (no pulse) — the session is live.
    dot: "bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/60",
    label: "text-emerald-300",
    dim: false,
  },
  released: {
    // zinc, muted, no pulse — a tombstone.
    dot: "bg-zinc-500",
    label: "text-zinc-400",
    dim: true,
  },
}

const ABSENT = "—" // em-dash for an absent (not-yet-enriched) field.

const GIB = 1024 * 1024 * 1024

/**
 * Render bytes as a GiB figure with one decimal (design-spec §4, "RAM 4.0
 * GiB"). 4 * 1024³ bytes → "4.0 GiB". Absent caps render the em-dash upstream,
 * so this only sees a real byte count.
 */
function formatGiB(bytes: number): string {
  return `${(bytes / GIB).toFixed(1)} GiB`
}

/**
 * Render fractional cores as the design shows them ("2.0 cores", "0.5 cores").
 */
function formatCores(cores: number): string {
  return `${cores.toFixed(1)} cores`
}

export function SessionCard({
  session,
  now,
}: {
  session: SessionView
  now: Date
}): ReactElement {
  const style = STATE_STYLE[session.state]
  const caps = session.caps
  const age = formatAge(ageSeconds(session.reserved_at, now))

  return (
    <article
      data-testid="session-card"
      className={[
        "rounded-lg border border-zinc-800 bg-zinc-900 p-4",
        "flex flex-col gap-3 text-sm",
        style.dim ? "opacity-60" : "",
      ].join(" ")}
    >
      {/* Top row: state badge · key (mono) · age chip. */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            data-testid="state-dot"
            aria-hidden="true"
            className={[
              "inline-block h-2.5 w-2.5 rounded-full",
              style.dot,
            ].join(" ")}
          />
          <span
            data-testid="state-label"
            className={["font-medium", style.label].join(" ")}
          >
            {stateLabel(session.state)}
          </span>
        </div>

        <span
          data-testid="session-key"
          className="font-mono text-zinc-300"
          title={session.session_key}
        >
          {session.session_key}
        </span>

        <span
          data-testid="age-chip"
          className="font-mono text-xs text-zinc-400 tabular-nums"
        >
          {"⧗ "}
          {age}
        </span>
      </header>

      <hr className="border-zinc-800" />

      {/* Owner: tenant / caller. */}
      <div data-testid="owner" className="text-zinc-400">
        <span className="font-mono">tenant/{session.owner.tenant}</span>
        <span className="px-2 text-zinc-600">·</span>
        <span className="font-mono">caller/{session.owner.caller}</span>
      </div>

      <hr className="border-zinc-800" />

      {/* Caps row: CPU · RAM · PIDs (em-dash for each absent field). */}
      <dl className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-zinc-300">
        <div className="flex items-baseline gap-1">
          <dt className="text-zinc-500">CPU</dt>
          <dd data-testid="cap-cpu">
            {caps ? formatCores(caps.cpu_cores) : ABSENT}
          </dd>
        </div>
        <div className="flex items-baseline gap-1">
          <dt className="text-zinc-500">RAM</dt>
          <dd data-testid="cap-ram">
            {caps ? formatGiB(caps.memory_bytes) : ABSENT}
          </dd>
        </div>
        <div className="flex items-baseline gap-1">
          <dt className="text-zinc-500">PIDs</dt>
          <dd data-testid="cap-pids">
            {caps && caps.pids_limit !== undefined ? caps.pids_limit : ABSENT}
          </dd>
        </div>
      </dl>

      {/* Container name (em-dash when absent / not yet bound). */}
      <div className="font-mono text-xs text-zinc-500">
        <span>container: </span>
        <span data-testid="container-name" className="text-zinc-300">
          {session.container_name ?? ABSENT}
        </span>
      </div>
    </article>
  )
}
