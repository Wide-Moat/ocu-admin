// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // CommonJS tooling config (e.g. .dependency-cruiser.cjs) uses `module`,
    // `require`, etc. Give it the CommonJS source type and Node globals so the
    // base no-undef rule does not flag them.
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: globals.node,
    },
  },
  {
    // The read/data module and the BFF surface are both read-only-leaf code:
    // neither may import a mutating authority. (dependency-cruiser pins the same
    // boundary; this ESLint rule is the editor-time twin.)
    files: ["src/lib/read/**/*.{ts,tsx}", "src/app/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // Cover the authority module imported at its root AND at any
              // depth, via both relative and alias paths. A single-segment
              // `@/lib/authority/*` would miss the bare `@/lib/authority` /
              // `../authority` root import — the exact bypass that would leave
              // the boundary the constitution advertises only half-guarded.
              group: [
                "**/authority",
                "**/authority/**",
                "@/lib/authority",
                "@/lib/authority/**",
              ],
              message:
                "Read-only leaf: the read module and the BFF cannot import a mutating authority.",
            },
          ],
        },
      ],
    },
  },
  { ignores: [".next/**", "node_modules/**"] },
)
