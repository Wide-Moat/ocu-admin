// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import js from "@eslint/js"
import tseslint from "typescript-eslint"

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/lib/read/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/authority/**", "@/lib/authority/*"],
              message:
                "Read-only leaf: the read module cannot import a mutating authority.",
            },
          ],
        },
      ],
    },
  },
  { ignores: [".next/**", "node_modules/**"] },
)
