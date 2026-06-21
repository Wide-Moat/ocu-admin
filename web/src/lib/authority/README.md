<!-- SPDX-License-Identifier: FSL-1.1-Apache-2.0 -->
<!-- Copyright (c) 2025 Open Computer Use Contributors -->

# Forbidden zone (import boundary)

This directory marks the mutating-authority zone (destroy / revoke / denylist /
quota analogs). The read/data module under `../read` and the BFF data layer MUST
NOT import from here. The boundary is enforced by `.dependency-cruiser.cjs` and
ESLint `no-restricted-imports`. `ocu-admin` is a read-only leaf; a violation is
a build failure, not a runtime check.
