// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "read-must-not-import-authority",
      severity: "error",
      comment:
        "Nothing in the console may import a mutating authority " +
        "(destroy/revoke/denylist/quota). ocu-admin is a read-only leaf. " +
        "Covers the whole app tree (src/app — pages, layout, and the BFF " +
        "under src/app/api), the read module (src/lib/read), the dashboard " +
        "components (src/components), and the middleware (src/middleware.ts).",
      from: {
        path: ["^src/(app|components|lib/read)/", "^src/middleware\\.ts$"],
      },
      to: { path: "^src/lib/authority" },
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
  },
}
