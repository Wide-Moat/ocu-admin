// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { execSync } from "node:child_process"
import { describe, it, expect } from "vitest"

describe("import boundary", () => {
  it("depcruise passes on the clean tree", () => {
    // Exits 0 when no forbidden edge exists.
    expect(() =>
      execSync("npx depcruise --config .dependency-cruiser.cjs src", {
        stdio: "pipe",
      }),
    ).not.toThrow()
  })
})
