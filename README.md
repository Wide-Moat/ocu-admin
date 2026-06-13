<!-- SPDX-License-Identifier: FSL-1.1-Apache-2.0 -->
<!-- Copyright (c) 2025 Open Computer Use Contributors -->

# ocu-admin

A read-only web dashboard for operators of an Open Computer Use deployment. It
shows the sandbox sessions and their status at a glance: which sessions exist,
their lifecycle state, who created them, the resource limits they were given,
and two summary stats (active-session count and average start time).

It is **read-only**. Every action that changes the system — stopping a session,
editing the denylist, changing quotas — is done with the CLI, not here.

For live CPU / memory graphs, point your existing Grafana at the deployment's
metrics endpoint; this dashboard links to it rather than re-drawing it.

## Logging in

One operator account, set in configuration — a username and a bcrypt password
hash in environment variables. No identity provider, no single sign-on, no user
management.

## On by default, optional

The dashboard runs by default. A deployment that does not want it turns it off
in one switch and loses nothing — the CLI, GitOps, and Grafana remain the
complete operator path.

## Status

Pre-development scaffold. It is a projection of the control plane's existing
operator metrics and audit events; it adds no new control-plane state. The
control-plane state layer it reads from is not yet built, so this dashboard
cannot ship before it. The architecture and specifications are the source of
truth and live in
[`Wide-Moat/open-computer-use`](https://github.com/Wide-Moat/open-computer-use)
under `docs/architecture/`.
