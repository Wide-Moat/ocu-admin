// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "read-must-not-import-authority",
      severity: "error",
      comment:
        "The read-only console's read/data module AND its BFF surface cannot " +
        "import a mutating authority (destroy/revoke/denylist/quota). ocu-admin " +
        "is a read-only leaf. Covers the real BFF (src/app/api) and the read " +
        "module (src/lib/read, for when it lands).",
      from: { path: "^src/(app/api|lib/read)" },
      to: { path: "^src/lib/authority" },
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
  },
}
