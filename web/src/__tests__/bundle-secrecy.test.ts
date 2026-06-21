// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

// The operator plane is a Unix socket; its path must never reach the client
// tree (src/app). This walks the client source and asserts no UDS-socket
// marker is present. Flip RED if a .sock path or operator-socket env leaks in.
const UDS_MARKERS = [/\.sock\b/, /operator[_-]?socket/i, /SO_PEERCRED/]

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe("bundle secrecy", () => {
  it("the client tree (src/app) carries no UDS-socket marker", () => {
    const files = walk(join(process.cwd(), "src/app")).filter((f) =>
      /\.(ts|tsx)$/.test(f),
    )
    for (const f of files) {
      const body = readFileSync(f, "utf8")
      for (const marker of UDS_MARKERS) {
        expect(marker.test(body), `${f} contains UDS marker ${marker}`).toBe(
          false,
        )
      }
    }
  })
})
