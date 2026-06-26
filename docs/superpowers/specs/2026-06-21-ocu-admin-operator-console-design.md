<!-- SPDX-License-Identifier: FSL-1.1-Apache-2.0 -->
<!-- Copyright (c) 2025 Open Computer Use Contributors -->

# ocu-admin — read-only operator console — design

**Status:** design, pending owner review
**Upstream read-surface contract:** ADR-0022 (admin read-surface) — drafted, NOT
yet ratified (`status: proposed` on the unmerged branch
`feat/admin-read-surface-contract` @ `a8064807` in `Wide-Moat/open-computer-use`;
that sha is not `next/v1` canon). The shape is **not frozen**. Read-surface code
is gated on ADR-0022 `status: accepted` on `next/v1`; named-read-identity code is
additionally gated on ADR-0004 accepted on `next/v1`.
**Date:** 2026-06-21

## 1. What this is

A read-only web console for operators of an Open Computer Use deployment. It
shows sandbox sessions at a glance — lifecycle state, owner, the resource caps a
session was given — plus two summary stats (active-session count, average start
time). It adds no control-plane state and exposes no mutating path. Stop / scale
/ denylist / quota stay in the CLI and GitOps.

It is **optional, default-on**: one switch turns it off and the CLI + GitOps +
Grafana remain the complete operator path.

## 2. Load-bearing invariants (from canon, not re-decided here)

These come from `CLAUDE.md`, `README.md`, and ADR-0022. They constrain the
design; they are not negotiable in this repo.

1. **Read-only projection (leaf).** The console reads the operator-plane read
   API and re-exposes read tiles only. No new control-plane state. Live CPU/RAM
   is out of scope — the deployment's Grafana owns it; the console links to it.
2. **No mutating reach, enforced structurally.** The read client lives in a
   module that cannot import a mutating authority (destroy / revoke / denylist /
   quota). Enforced with `dependency-cruiser` + ESLint `no-restricted-imports`
   zones — a build failure, not a comment.
3. **Browser never touches `ocu-control`.** The operator plane is a host-owned
   `0700` Unix socket with `SO_PEERCRED` identity (ADR-0004); a browser cannot
   dial it. A server-side **BFF** (Next.js route handlers) is the only
   browser-to-control hop. It holds the UDS dial and the auth gate. The browser
   bundle never contains a socket path or credential.
4. **Plain auth, no IdP.** One operator account — a username + bcrypt password
   hash from config/env (NFR-SEC-84). A first-party `SameSite=Strict` HttpOnly
   cookie. No OIDC, no `next-auth`, no user management. No session without a
   valid cookie → 401, no fallback.
5. **No invented data, never ahead of canon.** Type generation is BLOCKED until
   ADR-0022 ratifies (`status: accepted` on `next/v1`); the shape is not frozen,
   so types are not generated from the unmerged draft. Until then the only data
   source is a checked-in fixture. Once ratified, types come from the ratified
   ADR-0022 shape and the mock reflects exactly that shape, inventing no fields.

Accepted limitations (recorded in ADR-0022, surfaced honestly in the UI, not
hidden and not papered over with fake personalization):

- **Shared console password** — one bcrypt credential, not per-operator accounts.
- **No per-operator attribution** — a console read is not an audited per-human
  action; the BFF dials as one operator peer.
- **Operator-sees-all** — the console projects every session in the deployment;
  no per-operator scoping of the read.

## 3. The drafted data contract (ADR-0022 — not yet ratified)

This is the **drafted** shape from ADR-0022 (`status: proposed`, unmerged). It is
NOT frozen and may change before ratification; it is recorded here to design
against, not to generate types from until ADR-0022 is accepted on `next/v1`.

The BFF speaks these endpoints to `ocu-control` over the operator UDS. The
browser speaks the same shapes to the BFF over HTTPS.

```ts
type SessionView = {
  session_key: string; // canon name (the host-derived reservation key)
  owner: { tenant: string; caller: string }; // from the AUDIT/host-side projection, NOT the lifecycle handle (see below)
  state: "reserved" | "active" | "released"; // lowercase, exact
  container_name?: string; // bound after activation; absent until then
  caps?: {
    // activation enrichment; absent until active
    cpu_cores: number;
    memory_bytes: number; // integer (bytes); hard ceiling, exclusiveMinimum 0
    pids_limit?: number;
  };
  reserved_at: string; // ISO; ALWAYS present
  active_at?: string; // ISO; absent until the row reaches active
};

type DeploymentView = {
  runtime_tier: "runc" | "gvisor" | "firecracker"; // deployment-wide singleton
  runtime_provider: "docker" | "k8s"; // deployment-wide singleton
};
```

Endpoints (all GET, through the BFF):

| Endpoint                              | Returns              | Notes                                                      |
| ------------------------------------- | -------------------- | ---------------------------------------------------------- |
| `GET /v1alpha/sessions`               | `SessionView[]`      | `?include_released` adds RELEASED tombstones               |
| `GET /v1alpha/sessions/{session_key}` | `SessionView` \| 404 | single enriched row                                        |
| `GET /v1alpha/deployment`             | `DeploymentView`     | deployment-wide singletons                                 |
| `GET /metrics`                        | Prometheus text      | counts-by-state, create/destroy, reserved→active histogram |
| `GET /v1alpha/events`                 | `text/event-stream`  | **future additive, not frozen** — poll first               |

**State → UI label mapping:** `reserved` → _Creating_, `active` → _Live_,
`released` → _Destroyed_.

**Derived values (never from a row):**

- **Average start time** = parsed from the `/metrics` reserved→active
  duration histogram. Never `active_at − reserved_at` of one row, never from the
  registry. The BFF parses the Prometheus exposition and returns the summary.
- **Age** of a session (for the card) = `now − reserved_at`. This is "how long
  it has existed", not start time.

**Owner provenance — from the audit projection, never the lifecycle handle.**
The frozen operator-REST `SessionHandle` (canon `contracts/openapi/operator-rest.openapi.yaml`)
deliberately carries **no** owner: caller identity is host-attested from the
operator transport's peer credential and is never a body field (NFR-SEC-43). So
`SessionView.owner` is **not** a projection of the create/lifecycle handle — the
read surface derives it host-side from the audit/host-side ownership record, the
same surface that attributes a session to its `tenant`/`caller`. The console
renders what the read surface emits; it does not reconstruct owner from a
lifecycle field that has none.

> **Open question (for ADR-0022 to pin):** ADR-0022 must name owner's
> provenance on the read surface — that `tenant`/`caller` come from the
> audit/host-side ownership projection, not the lifecycle handle — so phase-4
> type-gen does not invent an owner field the frozen write-shape never emits.
> Until ADR-0022 pins this, the fixture supplies owner and the BFF treats it as
> read-surface-sourced, inventing no lifecycle-handle field.

**Tier source, with a forward seam:** `runtime_tier` is a deployment-wide
singleton today (shown as a header badge). NFR-SEC-38 allows mixed-tier per
trust-profile in the future. The card's tier field is designed so its source can
flip from the `/deployment` singleton to a future per-row `tier` with no UI
change.

**503 = Denied.** A `BoundedReason` envelope from the control plane surfaces as
a "control plane unavailable / busy" state, not a crash.

## 4. Visual design — dark operator console

NOC aesthetic. Deep neutral background (zinc-950), muted card surfaces
(zinc-900, hairline zinc-800 borders), one accent hue for interaction. Geist
Sans for UI, Geist Mono for technical values (`key`, `container_name`, caps). A
tool, not a marketing page — dense but breathing.

**Lifecycle color coding:**

| State      | Label     | Color   | Motion                      |
| ---------- | --------- | ------- | --------------------------- |
| `reserved` | Creating  | amber   | pulsing dot (being built)   |
| `active`   | Live      | emerald | steady glow                 |
| `released` | Destroyed | zinc    | muted, no pulse (tombstone) |

### Session card (the primitive)

```
┌─────────────────────────────────────────┐
│ ● Live          sess-7f3a··    ⧗ 4m 12s  │  state badge · key (mono) · age
│ ───────────────────────────────────────  │
│ tenant/acme · caller/api-bot             │  owner{tenant,caller}
│ ───────────────────────────────────────  │
│ CPU 2.0 cores   RAM 4.0 GiB   PIDs 512   │  caps (or "—" while Creating)
│ container: ocu-sb-7f3a                    │  container_name (or "—")
└─────────────────────────────────────────┘
```

- On `reserved` (Creating): `caps`, `container_name`, `active_at` are absent →
  render `—` gracefully. Badge pulses amber.
- On `reserved → active`: animate amber → emerald; caps fade in; container_name
  appears. (In mock, driven by a timer; in real, by the next poll/SSE delta.)
- On `released`: card dims, badge greys, no pulse. Only shown with
  `?include_released`.

### Dashboard layout

- **Header bar:** name · `runtime_tier` badge · `runtime_provider` ·
  "Live metrics → Grafana" link · logout.
- **Stats tiles (exactly two, per canon):** **Active sessions** (count of
  `state==active`) · **Avg start time** (from `/metrics` histogram).
- **Sessions grid:** live cards, auto-refresh (polling now; SSE seam later).
  Filter chip "Show destroyed" (toggles `?include_released`). Sort by age/state.
- **States:** 503 → "Control plane unavailable" banner; empty → "No active
  sessions"; unauthenticated → redirect to login.

## 5. Architecture

```
Browser ──HTTPS──► Next.js server route (BFF) ──UDS──► ocu-control operator socket
                   ├ bcrypt-cookie auth gate (401, no fallback)
                   ├ UDS dial (browser never sees socket/cred)
                   ├ parses /metrics Prometheus → avg-start
                   └ flips mock→real per endpoint (zero UI change)
```

- **App lives under `web/`** (per `.gitignore`). `.gitignore`'s Go section is a
  scaffold-template remnant; this is a TypeScript/Next.js repo — the Go lines
  will be removed.
- **Module boundary:** read-tile/data modules vs any authority/controller module
  — the boundary `dependency-cruiser` and ESLint pin. The BFF data layer may
  import read types only.
- **Mock-first, flip per-endpoint:** the BFF returns seeded live data with a
  lifecycle simulation (`reserved → active → released` on a timer; caps and
  `active_at` appear on `active`). Each endpoint flips mock → real when
  `pjyjol0z` lands it, with zero UI change.

## 6. Phases (GSD)

Authored in `.planning/` by direct Write/Edit (not `gsd-tools phase add` — it
renumbers plan IDs and strips prose; fleet lesson).

1. **Scaffold + CI gates + live constitution rules** (PR-1). Next.js App Router
   - TS, Tailwind + shadcn/ui, directory structure, BFF seam, import-boundary
     rule, and all gates that pass green on a scaffold tree with no app code:
     gitleaks (wire the committed `.gitleaks.toml`), `tsc --noEmit`,
     ESLint + Prettier, dependency-cruiser import-boundary, knip, semgrep
     (`scan --error`), vitest + v8 coverage
     **report-only** (floor 0, not blocking on an empty tree). CONSTITUTION rules
     live from this commit (the gates ARE their enforcement).
2. **Auth** — bcrypt verify + `SameSite=Strict` HttpOnly cookie, 401 no
   fallback, route-handler/middleware gate. Flip coverage ≥80% threshold and
   turn on Stryker ≥60% on the auth path (this is where that code first exists).
3. **Dashboard UI (pro-max)** — live cards, lifecycle transitions, two stats
   tiles, deployment badge, dark theme, Grafana link, 503/empty/loading states.
4. **Mock-contract BFF client** — GATED on ADR-0022 `status: accepted` on
   `next/v1`; type generation is BLOCKED until then (the shape is not frozen).
   Once unblocked: types from the ratified ADR-0022 shape, mock BFF with
   polling + lifecycle simulation, 503/`BoundedReason` handling.
5. **Flip mock → real per-endpoint** — as `pjyjol0z` lands `/sessions`,
   `/{session_key}`, `/deployment`, `/metrics`. Depends on upstream; decoupled
   by the mock.
6. **Constitution finalization** — mutation-proof per "never" (flip a guard →
   RED → green on revert), full tool→language map, activation rule for the
   deferred coverage/Stryker gates.

CI sequencing respects hard-ordering: PR-1 installs only gates that are green on
a tooling/scaffold tree; coverage-threshold and mutation gates are code-coupled
and activate in phase 2 where their app code lands.

## 7. The five "never"s (constitution, live from PR-1)

Each is enforced by a PR-1 gate; each gets a mutation-proof in phase 6.

1. **Never mutating reach** — the read/BFF module cannot import or call
   destroy / revoke / denylist / quota. Guard: dependency-cruiser +
   `no-restricted-imports`.
2. **Never an OCU secret in the browser** — the BFF holds the UDS dial + auth;
   the browser bundle contains no socket path or credential. Guard: a test that
   asserts the client bundle is free of the UDS path / cred markers.
3. **Never anonymous** — bcrypt cookie `SameSite=Strict` HttpOnly; no session
   without a valid cookie → 401, no fallback. Guard: auth middleware test.
4. **Never invented data, never ahead of canon** — type generation is BLOCKED
   until ADR-0022 ratifies (`status: accepted` on `next/v1`); the shape is not
   frozen, so no types from the unmerged draft. Fixture-only until then. Guard:
   the hard-ordering gate + type-gen from the ratified contract + a shape test.
5. **Never new control-plane state** — the console projects what the control
   plane reports; it owns no mutable state. Guard: the all-GET surface + the
   import boundary.

## 8. Out of scope (stated so they read as choices, not gaps)

- Live CPU/RAM graphs (Grafana owns them; we link).
- Warm-pool view.
- Per-operator accounts / per-read attribution (ADR-0022 open question 1).
- A frozen SSE delta schema (ADR-0022 open question 2; poll first).
- Any mutating action.
