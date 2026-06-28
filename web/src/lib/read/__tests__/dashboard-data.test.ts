// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect } from "vitest"
import { loadDashboardData } from "../dashboard-data"
import { ReadUnavailableError, type ReadClient } from "../client"
import {
  fixtureDeployment,
  fixtureSessions,
  fixtureStartHistogram,
} from "../fixture"

// loadDashboardData is the page's data seam: it gathers deployment + sessions +
// histogram through a ReadClient and reports the Dashboard state. On a healthy
// client it returns state="ok" with the three view inputs; on a
// ReadUnavailableError (the 503 / BoundedReason path) it returns
// state="unavailable" with safe empty inputs — page.tsx maps that straight to
// <Dashboard state="unavailable">. The ReadClient is injected here so the test
// drives both paths without a live server.

function okClient(): ReadClient {
  return {
    listSessions: async () => fixtureSessions,
    getSession: async (key) =>
      fixtureSessions.find((s) => s.key === key) ?? null,
    getDeployment: async () => fixtureDeployment,
    getMetrics: async () => fixtureStartHistogram,
  }
}

function unavailableClient(status: number): ReadClient {
  const fail = async (): Promise<never> => {
    throw new ReadUnavailableError(status, "/v1alpha/sessions")
  }
  return {
    listSessions: fail,
    getSession: fail,
    getDeployment: fail,
    getMetrics: fail,
  }
}

describe("loadDashboardData", () => {
  it("returns state=ok with deployment, sessions, and histogram on a healthy client", async () => {
    const data = await loadDashboardData(okClient())
    expect(data.state).toBe("ok")
    expect(data.deployment).toEqual(fixtureDeployment)
    expect(data.sessions).toEqual(fixtureSessions)
    expect(data.histogram).toEqual(fixtureStartHistogram)
  })

  it("maps a ReadUnavailableError to state=unavailable with safe empty inputs", async () => {
    const data = await loadDashboardData(unavailableClient(503))
    expect(data.state).toBe("unavailable")
    // Safe defaults so the Dashboard chrome (stats, badge) still renders.
    expect(data.sessions).toEqual([])
    expect(data.histogram.observation_count).toBe(0)
  })

  it("re-throws a non-ReadUnavailable error (a real bug is not silently swallowed)", async () => {
    const boom: ReadClient = {
      listSessions: async () => {
        throw new TypeError("unexpected")
      },
      getSession: async () => null,
      getDeployment: async () => fixtureDeployment,
      getMetrics: async () => fixtureStartHistogram,
    }
    await expect(loadDashboardData(boom)).rejects.toBeInstanceOf(TypeError)
  })
})
