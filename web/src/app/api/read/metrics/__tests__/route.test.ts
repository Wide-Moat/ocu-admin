// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect } from "vitest"
import { GET } from "../route"
import { parsePrometheusHistogram } from "@/lib/read/client"
import { fixtureStartHistogram } from "@/lib/read/fixture"

// The /metrics shipped GET emits Prometheus TEXT for the fixture histogram, so
// the read client's Prometheus parser round-trips against the real handler
// output — the same parser the live BFF would use. Parsing the emitted text
// must reproduce the fixture histogram's sum and count exactly.

describe("GET /api/read/metrics", () => {
  it("returns 200 with a text/plain Prometheus exposition", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/plain")
    const text = await res.text()
    expect(text).toContain("_bucket{le=")
    expect(text).toContain("_sum ")
    expect(text).toContain("_count ")
  })

  it("the emitted text round-trips through the client parser to the fixture histogram", async () => {
    const text = await (await GET()).text()
    const h = parsePrometheusHistogram(text)
    expect(h.sum_seconds).toBe(fixtureStartHistogram.sum_seconds)
    expect(h.observation_count).toBe(fixtureStartHistogram.observation_count)
    expect(h.buckets).toEqual(fixtureStartHistogram.buckets)
  })
})
