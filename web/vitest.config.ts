// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*" -> "./src/*" so tests resolve app imports.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // The auth phase brings the first load-bearing source, so the threshold
      // is now active (CONSTITUTION "Activation rule"). Scope coverage to the
      // testable auth/BFF logic; the Next.js shell (layout/page) and pure
      // config files are not unit-tested here.
      include: ["src/lib/auth/**", "src/app/api/**", "src/middleware.ts"],
      thresholds: {
        statements: 80,
        functions: 80,
        lines: 80,
        branches: 80,
      },
    },
  },
})
