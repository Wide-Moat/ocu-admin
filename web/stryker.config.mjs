// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// Mutation testing for the auth path — the load-bearing security code. A green
// test suite is not enough (CONSTITUTION "Verification discipline"): Stryker
// mutates the source systematically and a surviving mutant means a test that
// does not actually constrain behaviour. Scoped to the auth modules; the break
// threshold is the gate.

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  coverageAnalysis: "perTest",
  mutate: [
    "src/lib/auth/**/*.ts",
    "src/app/api/auth/**/*.ts",
    "src/middleware.ts",
    "!src/**/__tests__/**",
  ],
  reporters: ["clear-text", "progress"],
  thresholds: {
    // >=60% on the auth path (per the activation plan). `break` fails the run
    // below this, making it a real gate rather than a report.
    high: 80,
    low: 60,
    break: 60,
  },
}
