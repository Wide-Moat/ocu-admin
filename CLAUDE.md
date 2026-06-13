# Project Instructions — ocu-admin

This repository is the **implementation** of the Open Computer Use read-only
operator console. The **architecture and specifications** are the source of
truth and live in `Wide-Moat/open-computer-use` under `docs/architecture/`. Do
not re-decide here what an ADR already decided; if a decision must change, it
changes in the architecture repo first.

This repo is **public**.

## What this is

A thin **read-only** projection of the control plane's existing operator
metrics and audit-pipeline lifecycle events. It renders session lifecycle
state, the resource limits a session was given, and two summary stats. It adds
no new control-plane state and exposes no mutating path.

## Invariants (load-bearing)

- **Read-only projection (leaf).** No component reads from this console; it
  reads from the audit/metrics surface and re-exposes read tiles only. Live
  CPU/RAM is out of scope here — the deployment's Grafana owns it; the console
  links to it.
- **No mutating route, enforced structurally.** The read client lives in a
  package that cannot import `denylist.Authority`, `quota.Admin`, or
  `lifecycle.Controller`; an import-boundary test pins this. Stop / scale /
  denylist / quota stay in the CLI and GitOps, never here.
- **Plain auth, no IdP.** One operator username + bcrypt password hash from
  config/env; a first-party `SameSite=Strict` HttpOnly cookie (the console is
  its own top-level origin and is never embedded). No OIDC, no embed token, no
  user management.
- **Optional, default-on.** Runs by default; one switch turns it off; nothing
  depends on it being present.

## Hard ordering

This console reads the control plane's state through its audit/metrics surface,
which is not yet built (the Postgres state layer in `ocu-sandbox` is deferred,
and the read surface + its read identity must be named in the architecture
repo first). No code here may precede that chain.

## Working rules

- English only — code, comments, commits, PRs, docs.
- SPDX header as the first comment of every new source file
  (`// SPDX-License-Identifier: FSL-1.1-Apache-2.0` +
  `// Copyright (c) 2025 Open Computer Use Contributors`).
- Git identity `developer@widemoat.ai`. Conventional commits. One PR per
  logical change. No merge without an explicit per-PR instruction.
