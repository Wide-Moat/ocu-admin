<!-- SPDX-License-Identifier: FSL-1.1-Apache-2.0 -->
<!-- Copyright (c) 2025 Open Computer Use Contributors -->

# Forbidden zone (import boundary)

This directory marks the mutating-authority zone (destroy / revoke / denylist /
quota analogs). The read/data module under `../read` and the BFF surface under
`../../app/api` MUST NOT import from here. Both `from` paths are pinned by the
`read-must-not-import-authority` rule in `.dependency-cruiser.cjs` and by ESLint
`no-restricted-imports` (scoped to `src/lib/read/**` and `src/app/api/**`).
`ocu-admin` is a read-only leaf; a violation is a build failure, not a runtime
check.
