// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { execSync } from "node:child_process"
import { mkdirSync, writeFileSync, rmSync } from "node:fs"
import { describe, it, expect } from "vitest"

// The import boundary (read-must-not-import-authority) is the load-bearing
// "console cannot mutate" guard. A green-only assert is not a guard: it passes
// whether or not the rule exists, so a deleted or weakened rule would not red
// this test. The negative cases below plant a real forbidden edge under each
// guarded `from` path and assert depcruise REDS on it — so the test fails if the
// rule is removed, which is what makes it a regression guard and not a tautology.

function depcruise(): void {
  execSync("npx depcruise --config .dependency-cruiser.cjs src", {
    stdio: "pipe",
  })
}

// Plant a real authority target plus an importer under `dir`, run `fn`, then
// remove both — depcruise resolves real modules, so an import of a
// non-existent path would not be flagged; the target file must exist.
function withForbiddenEdge(dir: string, fn: () => void): void {
  const authorityDir = "src/lib/authority"
  const authorityFile = `${authorityDir}/__boundary_probe__.ts`
  const importerDir = dir
  const importerFile = `${importerDir}/__boundary_probe__.ts`
  try {
    mkdirSync(authorityDir, { recursive: true })
    mkdirSync(importerDir, { recursive: true })
    writeFileSync(authorityFile, "export const probe = 1\n")
    writeFileSync(
      importerFile,
      'import { probe } from "@/lib/authority/__boundary_probe__"\nvoid probe\n',
    )
    fn()
  } finally {
    rmSync(authorityFile, { force: true })
    rmSync(importerFile, { force: true })
  }
}

describe("import boundary", () => {
  it("depcruise passes on the clean tree", () => {
    // Exits 0 when no forbidden edge exists.
    expect(() => depcruise()).not.toThrow()
  })

  it("depcruise reds a forbidden authority import from the BFF surface", () => {
    withForbiddenEdge("src/app/api", () => {
      expect(() => depcruise()).toThrow()
    })
  })

  it("depcruise reds a forbidden authority import from the read module", () => {
    withForbiddenEdge("src/lib/read", () => {
      expect(() => depcruise()).toThrow()
    })
  })
})
