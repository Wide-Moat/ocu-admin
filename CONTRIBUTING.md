# Contributing to ocu-admin

Thank you for your interest in contributing. This document describes the gates
every contribution must clear and the workflow to follow.

Questions or help: **developer@widemoat.ai**

---

## Quick orientation

`ocu-admin` is the read-only operator console of Open Computer Use — a thin
projection of the control plane's operator metrics and audit events.
Architecture decisions live in
[`Wide-Moat/open-computer-use`](https://github.com/Wide-Moat/open-computer-use)
under `docs/architecture/`. If a decision must change, it changes there first —
never by unilateral code change here.

---

## License

This project is licensed under **FSL-1.1-Apache-2.0**. Two years after each
release the license converts automatically to Apache-2.0. See [LICENSE](./LICENSE).

### Required SPDX header on every new source file

Every new source file begins with a two-line SPDX header in the language's
comment syntax:

```
// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors
```

---

## Working rules

- **English only** — code, comments, commits, PRs, docs.
- **Read-only.** This console exposes no mutating path. The read client must
  not be able to import a control-plane authority (denylist / quota /
  lifecycle); an import-boundary test enforces this. Mutating actions stay in
  the CLI and GitOps.
- **Conventional commits**; one PR per logical change.
- **No merge without an explicit per-PR instruction.**
- Git identity `developer@widemoat.ai`.
