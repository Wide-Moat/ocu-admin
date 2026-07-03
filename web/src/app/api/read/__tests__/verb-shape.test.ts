// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// Read-route verb-shape invariant. The console is a read-only leaf: every route
// under `src/app/api/read/**` must expose GET and NOTHING else. Next.js routes a
// request method to a same-named export (a `POST` export makes `POST` a live
// mutating endpoint), so this asserts each read route module exports `GET` and
// exports none of POST / PUT / DELETE / PATCH — turning "read-only" from a
// convention into a pinned invariant that reds the moment a mutating handler is
// added to a read route.
//
// This complements, not duplicates, the per-route wire-level pin: each route
// test's `afterEach` asserts every request that reached the control socket was a
// GET (no mutating verb crosses the hop). That guards the RUNTIME behavior of
// the client; this guards the STATIC export surface of the handler module — a
// mutating export would ship a live endpoint even if the read client never calls
// it. Both are needed; neither subsumes the other.

import { describe, it, expect } from "vitest"

// Every read route module. HEAD is included in the forbidden set: while HEAD is
// nominally safe, the read surface exposes only GET, and an unexpected HEAD
// export would still be an unpinned surface — the leaf declares exactly one verb.
const READ_ROUTES = [
  { name: "deployment", mod: () => import("../deployment/route") },
  { name: "sessions", mod: () => import("../sessions/route") },
  { name: "sessions/[key]", mod: () => import("../sessions/[key]/route") },
  { name: "metrics", mod: () => import("../metrics/route") },
] as const

const MUTATING_VERBS = ["POST", "PUT", "DELETE", "PATCH", "HEAD"] as const

describe("read routes expose only GET", () => {
  for (const route of READ_ROUTES) {
    it(`${route.name} exports GET`, async () => {
      const mod = (await route.mod()) as Record<string, unknown>
      expect(typeof mod.GET).toBe("function")
    })

    it(`${route.name} exports no mutating verb (${MUTATING_VERBS.join("/")})`, async () => {
      const mod = (await route.mod()) as Record<string, unknown>
      const present = MUTATING_VERBS.filter((verb) => verb in mod)
      // An empty list is the read-only-leaf invariant: no mutating handler is
      // routable from a read route. A non-empty list names exactly which verb
      // regressed, so the failure points at the offending export.
      expect(present).toEqual([])
    })
  }
})
