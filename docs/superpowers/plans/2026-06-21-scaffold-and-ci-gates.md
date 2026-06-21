<!-- SPDX-License-Identifier: FSL-1.1-Apache-2.0 -->
<!-- Copyright (c) 2025 Open Computer Use Contributors -->

# Scaffold + CI Gates + Live Constitution — Implementation Plan (PR-1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js + TypeScript scaffold for the read-only operator
console under `web/`, with every code-quality gate that is green on a scaffold
tree wired into a blocking CI workflow from commit 1, and the constitution rules
live from the same commit.

**Architecture:** Next.js App Router (TS) under `web/`. A BFF seam (server-side
route handlers) is the only browser-to-control hop; the browser never dials the
operator UDS. The read/data module is structurally barred from importing a
mutating authority via dependency-cruiser + ESLint `no-restricted-imports`. CI
installs only gates that pass on a tree with no app code; coverage-threshold and
mutation gates are deferred to the auth phase where their code lands.

**Tech Stack (pinned, verified on npm 2026-06-21):** next@16.2.9,
typescript@6.0.3, eslint@10.5.0, typescript-eslint@8.61.1, prettier@3.8.4,
tailwindcss@4.3.1, knip@6.17.1, dependency-cruiser@17.4.3, vitest@4.1.9,
@vitest/coverage-v8@4.1.9, sober@1.1.10, @stryker-mutator/core@9.6.1 +
@stryker-mutator/vitest-runner@9.6.1 (scaffolded, deferred). semgrep@1.167.0
runs via pip/container in CI (not an npm dep). gitleaks uses the committed
`.gitleaks.toml`. Node 24.

---

## File Structure

```
web/
  package.json              # pinned deps + scripts (the local gate commands)
  tsconfig.json             # strict TS, noEmit typecheck
  next.config.ts            # Next.js config
  eslint.config.mjs         # flat config: typescript-eslint + no-restricted-imports zones
  .prettierrc.json          # prettier config
  knip.json                 # dead-code config (entrypoints declared)
  .dependency-cruiser.cjs   # import-boundary rules (read module ↛ authority)
  vitest.config.ts          # vitest + v8 coverage (report-only floor 0)
  stryker.config.json       # mutation config (scaffolded, deferred)
  .soberrc.json             # AI-slop scanner config
  src/
    app/
      layout.tsx            # root layout (dark theme shell)
      page.tsx              # placeholder landing (real dashboard = phase 3)
    lib/
      read/                 # the read/data module — may import read types ONLY
        .gitkeep
      authority/            # marker dir for the forbidden zone (BFF must not import)
        README.md           # documents why this zone exists (the import boundary)
    __tests__/
      import-boundary.test.ts  # asserts the read module cannot reach authority
      bundle-secrecy.test.ts   # asserts client bundle carries no UDS path/cred marker
.github/
  workflows/
    ci.yml                  # BLOCKING gates (every PR)
    pre-release.yml         # Stryker (workflow_dispatch + tag, non-blocking-merge)
CONSTITUTION.md             # the five "never"s — live from this commit
CLAUDE.md                   # append: gates, forbidden list, tool→language map
.gitignore                  # remove Go-template lines; keep node/coverage
```

---

## Task 1: Clean `.gitignore` of the Go-template remnant

**Files:**
- Modify: `/Users/nick/ocu-admin/.gitignore`

- [ ] **Step 1: Remove the Go build/runtime block**

This is a TypeScript/Next.js repo; the Go lines are scaffold-template noise.
Remove these lines from `.gitignore`:

```
# ─── Go build/runtime ───
/ocu-admin
*.bin
cover.out
*.coverprofile
```

Keep the node/vite, coverage, env, and CLAUDE.local.md blocks.

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: drop Go-template lines from .gitignore (this is a TS repo)"
```

---

## Task 2: Scaffold the Next.js app under `web/`

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/next.config.ts`
- Create: `web/.prettierrc.json`
- Create: `web/src/app/layout.tsx`
- Create: `web/src/app/page.tsx`

- [ ] **Step 1: Write `web/package.json` with pinned deps and gate scripts**

```json
{
  "name": "ocu-admin-web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format:check": "prettier --check .",
    "knip": "knip --no-progress",
    "depcruise": "depcruise --config .dependency-cruiser.cjs src",
    "sober": "sober scan . --fail-on hungover",
    "test": "vitest run",
    "test:cov": "vitest run --coverage"
  },
  "dependencies": {
    "next": "16.2.9",
    "react": "19.2.0",
    "react-dom": "19.2.0"
  },
  "devDependencies": {
    "typescript": "6.0.3",
    "@types/node": "24.7.0",
    "@types/react": "19.2.0",
    "@types/react-dom": "19.2.0",
    "eslint": "10.5.0",
    "typescript-eslint": "8.61.1",
    "@eslint/js": "10.5.0",
    "eslint-config-next": "16.2.9",
    "prettier": "3.8.4",
    "tailwindcss": "4.3.1",
    "@tailwindcss/postcss": "4.3.1",
    "knip": "6.17.1",
    "dependency-cruiser": "17.4.3",
    "vitest": "4.1.9",
    "@vitest/coverage-v8": "4.1.9",
    "sober": "1.1.10",
    "@stryker-mutator/core": "9.6.1",
    "@stryker-mutator/vitest-runner": "9.6.1"
  }
}
```

NOTE: react/@types versions are placeholders to verify with `npm view` at
execution time (pin to the latest that `next@16.2.9` peer-accepts). If a pinned
version does not resolve, STOP and surface it — do not float to `latest`.

- [ ] **Step 2: Install and verify the tree resolves**

Run: `cd web && npm install`
Expected: clean install, a `package-lock.json` is written, no peer-dep errors.
If any pinned version 404s, STOP and report — do not substitute.

- [ ] **Step 3: Write `web/tsconfig.json` (strict)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write `web/next.config.ts`**

```ts
// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

export default nextConfig
```

- [ ] **Step 5: Write `web/.prettierrc.json`**

```json
{
  "semi": false,
  "singleQuote": false,
  "printWidth": 80,
  "trailingComma": "all"
}
```

- [ ] **Step 6: Write the root layout `web/src/app/layout.tsx` (dark shell)**

```tsx
// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "OCU Operator Console",
  description: "Read-only operator console for an Open Computer Use deployment.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Write `web/src/app/globals.css` (Tailwind v4 entry)**

```css
@import "tailwindcss";
```

- [ ] **Step 8: Write the placeholder landing `web/src/app/page.tsx`**

The real dashboard is phase 3. This is a scaffold landing that proves the tree
builds — it states the console is pre-development and read-only.

```tsx
// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        OCU Operator Console
      </h1>
      <p className="text-zinc-400">
        Read-only projection of an Open Computer Use deployment. Scaffold —
        dashboard under construction.
      </p>
    </main>
  )
}
```

- [ ] **Step 9: Add postcss config for Tailwind v4 `web/postcss.config.mjs`**

```js
// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

const config = {
  plugins: { "@tailwindcss/postcss": {} },
}

export default config
```

- [ ] **Step 10: Verify the build and typecheck pass**

Run: `cd web && npm run typecheck && npm run build`
Expected: typecheck clean; `next build` succeeds, produces `.next/`.

- [ ] **Step 11: Commit**

```bash
git add web/ -- ':!web/node_modules'
git commit -m "feat: scaffold Next.js App Router + TS + Tailwind under web/"
```

---

## Task 3: Wire the import-boundary gate (dependency-cruiser + ESLint)

This is the load-bearing read-only invariant: the read/data module cannot import
a mutating authority. We create the directory structure that the rule pins, then
prove the rule fires RED when violated.

**Files:**
- Create: `web/src/lib/read/.gitkeep`
- Create: `web/src/lib/authority/README.md`
- Create: `web/.dependency-cruiser.cjs`
- Modify: `web/eslint.config.mjs`
- Test: `web/src/__tests__/import-boundary.test.ts`

- [ ] **Step 1: Create the two zones**

`web/src/lib/read/.gitkeep` — empty.

`web/src/lib/authority/README.md`:

```markdown
<!-- SPDX-License-Identifier: FSL-1.1-Apache-2.0 -->
<!-- Copyright (c) 2025 Open Computer Use Contributors -->

# Forbidden zone (import boundary)

This directory marks the mutating-authority zone (destroy / revoke / denylist /
quota analogs). The read/data module under `../read` and the BFF data layer MUST
NOT import from here. The boundary is enforced by `.dependency-cruiser.cjs` and
ESLint `no-restricted-imports`. `ocu-admin` is a read-only leaf; a violation is
a build failure, not a runtime check.
```

- [ ] **Step 2: Write `web/.dependency-cruiser.cjs`**

```js
// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "read-must-not-import-authority",
      severity: "error",
      comment:
        "The read-only console's read/data module cannot import a mutating " +
        "authority (destroy/revoke/denylist/quota). ocu-admin is a read-only leaf.",
      from: { path: "^src/lib/read" },
      to: { path: "^src/lib/authority" },
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
  },
}
```

- [ ] **Step 3: Write `web/eslint.config.mjs` with the boundary zone**

```js
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
```

- [ ] **Step 4: Write the import-boundary test (RED-proof harness)**

`web/src/__tests__/import-boundary.test.ts`:

```ts
// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { execSync } from "node:child_process"
import { describe, it, expect } from "vitest"

describe("import boundary", () => {
  it("depcruise passes on the clean tree", () => {
    // Exits 0 when no forbidden edge exists.
    expect(() =>
      execSync("npx depcruise --config .dependency-cruiser.cjs src", {
        stdio: "pipe",
      }),
    ).not.toThrow()
  })
})
```

- [ ] **Step 5: Run depcruise on the clean tree — expect PASS**

Run: `cd web && npm run depcruise`
Expected: exit 0, no violations.

- [ ] **Step 6: PROVE the gate fires RED (skeptic mutation)**

Temporarily create a violating edge, then confirm the gate goes RED:

```bash
cd web
mkdir -p src/lib/authority
printf '%s\n' '// SPDX-License-Identifier: FSL-1.1-Apache-2.0' '// Copyright (c) 2025 Open Computer Use Contributors' 'export const destroy = () => {}' > src/lib/authority/destroy.ts
printf '%s\n' '// SPDX-License-Identifier: FSL-1.1-Apache-2.0' '// Copyright (c) 2025 Open Computer Use Contributors' 'import { destroy } from "../authority/destroy"' 'export const leak = destroy' > src/lib/read/violation.ts
npm run depcruise; echo "EXIT=$?"
```

Expected: NON-ZERO exit, "read-must-not-import-authority" error reported (RED).

- [ ] **Step 7: Revert the mutation — confirm GREEN on revert**

```bash
cd web
rm src/lib/read/violation.ts src/lib/authority/destroy.ts
npm run depcruise; echo "EXIT=$?"
```

Expected: EXIT=0 (GREEN). Record the RED→green proof in the PR description.

- [ ] **Step 8: Commit**

```bash
git add web/.dependency-cruiser.cjs web/eslint.config.mjs web/src/lib web/src/__tests__/import-boundary.test.ts
git commit -m "feat: pin read-only import boundary (depcruise + eslint zone)"
```

---

## Task 4: Wire vitest + the bundle-secrecy test

The "never an OCU secret in the browser" guard: a test that asserts the client
bundle carries no UDS path or credential marker. On a scaffold tree there is no
bundle content yet, so this test asserts the source under `src/app` (client
tree) contains no UDS-socket marker — and is written so it goes RED if one is
introduced.

**Files:**
- Create: `web/vitest.config.ts`
- Test: `web/src/__tests__/bundle-secrecy.test.ts`

- [ ] **Step 1: Write `web/vitest.config.ts` (coverage report-only, floor 0)**

```ts
// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Report-only on the scaffold tree. Thresholds are flipped on in the
      // auth phase, where the first load-bearing source lands.
    },
  },
})
```

- [ ] **Step 2: Write the bundle-secrecy test**

`web/src/__tests__/bundle-secrecy.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the tests — expect PASS**

Run: `cd web && npm test`
Expected: both tests pass (import-boundary + bundle-secrecy).

- [ ] **Step 4: PROVE bundle-secrecy fires RED**

```bash
cd web
printf '%s\n' '// leak: /run/ocu/operator.sock' >> src/app/page.tsx
npm test; echo "EXIT=$?"
```

Expected: NON-ZERO exit, bundle-secrecy test FAILS (RED).

- [ ] **Step 5: Revert — confirm GREEN**

```bash
cd web
git checkout src/app/page.tsx
npm test; echo "EXIT=$?"
```

Expected: EXIT=0 (GREEN). Record the proof.

- [ ] **Step 6: Run coverage report-only**

Run: `cd web && npm run test:cov`
Expected: a coverage report prints; NO threshold failure (report-only).

- [ ] **Step 7: Commit**

```bash
git add web/vitest.config.ts web/src/__tests__/bundle-secrecy.test.ts
git commit -m "feat: vitest + bundle-secrecy guard (no UDS marker in client tree)"
```

---

## Task 5: Wire knip (dead-code) and sober (AI-slop)

**Files:**
- Create: `web/knip.json`
- Create: `web/.soberrc.json`

- [ ] **Step 1: Write `web/knip.json` with declared entrypoints**

Next.js framework entrypoints (`app/**`, config files) are declared so they are
not flagged as unused. Ambiguous public API is NOT auto-deleted — it goes to the
owner list.

```json
{
  "$schema": "https://unpkg.com/knip@6.17.1/schema.json",
  "entry": [
    "src/app/**/{page,layout,route,loading,error,not-found}.{ts,tsx}",
    "next.config.ts",
    "eslint.config.mjs",
    "vitest.config.ts",
    "postcss.config.mjs"
  ],
  "project": ["src/**/*.{ts,tsx}"],
  "ignore": ["src/__tests__/**"],
  "ignoreDependencies": [
    "@stryker-mutator/core",
    "@stryker-mutator/vitest-runner",
    "@tailwindcss/postcss",
    "tailwindcss"
  ]
}
```

- [ ] **Step 2: Run knip — expect clean (or an owner-list, never auto-delete)**

Run: `cd web && npm run knip`
Expected: exit 0 on the scaffold tree. If anything is flagged, record it for the
owner list; do NOT delete framework entrypoints or public API.

- [ ] **Step 3: Write `web/.soberrc.json`**

```json
{
  "failOn": "hungover",
  "ignore": ["node_modules", ".next", "coverage", "dist"]
}
```

NOTE: verify `sober`'s real config keys + CLI flags at execution time
(`npx sober --help`); pin the config to what the installed 1.1.10 accepts. If
the flag/key names differ, adjust to the real ones — do not invent.

- [ ] **Step 4: Run sober — record the starting score, expect GREEN**

Run: `cd web && npm run sober`
Expected: exit 0 (below `hungover`). Record the starting rung in the PR.

- [ ] **Step 5: Commit**

```bash
git add web/knip.json web/.soberrc.json
git commit -m "feat: wire knip (dead-code) and sober (AI-slop) gates"
```

---

## Task 6: Scaffold Stryker (mutation) — deferred, not blocking

Stryker is scaffolded but NOT run in the blocking gate. It targets the auth path
and the import-boundary guard, which do not exist yet. It activates in the auth
phase.

**Files:**
- Create: `web/stryker.config.json`

- [ ] **Step 1: Write `web/stryker.config.json`**

```json
{
  "$schema": "https://raw.githubusercontent.com/stryker-mutator/stryker-js/master/packages/api/schema/stryker-core.json",
  "packageManager": "npm",
  "testRunner": "vitest",
  "reporters": ["html", "clear-text", "progress"],
  "coverageAnalysis": "perTest",
  "mutate": [
    "src/lib/auth/**/*.ts",
    "src/lib/read/**/*.ts"
  ],
  "thresholds": { "high": 80, "low": 60, "break": 60 }
}
```

NOTE: `src/lib/auth/**` does not exist yet — Stryker is scaffolded for the auth
phase. Do NOT add `stryker run` to `ci.yml`; it goes in `pre-release.yml`.

- [ ] **Step 2: Commit**

```bash
git add web/stryker.config.json
git commit -m "chore: scaffold Stryker config (deferred to auth phase)"
```

---

## Task 7: The blocking CI workflow `ci.yml`

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
# SPDX-License-Identifier: FSL-1.1-Apache-2.0
# Copyright (c) 2025 Open Computer Use Contributors

name: ci
on:
  pull_request:
  push:
    branches: [main]

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITLEAKS_CONFIG: .gitleaks.toml

  semgrep:
    runs-on: ubuntu-latest
    container: semgrep/semgrep:1.167.0
    steps:
      - uses: actions/checkout@v4
      - run: >
          semgrep scan
          --config p/typescript
          --config p/react
          --config p/nextjs
          --config p/owasp-top-ten
          --error

  web-gates:
    runs-on: ubuntu-latest
    defaults:
      run: { working-directory: web }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run format:check
      - run: npm run depcruise
      - run: npm run knip
      - run: npm run sober
      - run: npm run test:cov   # report-only until source lands
```

NOTE: pin `gitleaks-action` and `setup-node`/`checkout` to the SHAs the fleet
standard uses if one exists; otherwise the major tags above are acceptable for
PR-1 and can be SHA-pinned in a follow-up.

- [ ] **Step 2: Validate the workflow YAML parses**

Run: `cd web && npx --yes yaml-lint ../.github/workflows/ci.yml` (or any YAML
validator available). Expected: valid YAML.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: blocking gate set (gitleaks, semgrep, tsc, eslint, prettier, depcruise, knip, sober, vitest)"
```

---

## Task 8: The pre-release workflow `pre-release.yml` (Stryker, deferred)

**Files:**
- Create: `.github/workflows/pre-release.yml`

- [ ] **Step 1: Write `.github/workflows/pre-release.yml`**

```yaml
# SPDX-License-Identifier: FSL-1.1-Apache-2.0
# Copyright (c) 2025 Open Computer Use Contributors

name: pre-release
on:
  workflow_dispatch:
  push:
    tags: ["v*"]

# Non-blocking-merge: mutation testing on the load-bearing modules once they
# exist (auth path + import-boundary guard). Until then this is a no-op note.
jobs:
  mutation:
    runs-on: ubuntu-latest
    defaults:
      run: { working-directory: web }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - name: Stryker (auth + read modules)
        run: |
          if [ -d src/lib/auth ]; then
            npx stryker run
          else
            echo "auth path not built yet — Stryker activates in the auth phase"
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/pre-release.yml
git commit -m "ci: scaffold pre-release Stryker workflow (activates in auth phase)"
```

---

## Task 9: CONSTITUTION.md — the five "never"s, live now

**Files:**
- Create: `/Users/nick/ocu-admin/CONSTITUTION.md`

- [ ] **Step 1: Write `CONSTITUTION.md`**

```markdown
<!-- SPDX-License-Identifier: FSL-1.1-Apache-2.0 -->
<!-- Copyright (c) 2025 Open Computer Use Contributors -->

# Constitution — ocu-admin

The read-only operator console's load-bearing "never"s. Each is enforced by a
gate that runs from the first commit; each gets a mutation-proof in the
finalization phase (flip the guard → the gate goes RED → green on revert). A
gate never seen red is not installed.

## 1. Never mutating reach

The read/data module and the BFF cannot import or call a mutating authority
(destroy / revoke / denylist / quota). **Guard:** `dependency-cruiser`
(`read-must-not-import-authority`) + ESLint `no-restricted-imports` on
`src/lib/read/**`.

## 2. Never an OCU secret in the browser

The BFF holds the operator-UDS dial and the auth gate; the browser bundle
carries no socket path or credential. The browser never dials `ocu-control`.
**Guard:** the bundle-secrecy test (no UDS marker in the client tree).

## 3. Never anonymous

A bcrypt-verified operator credential + a `SameSite=Strict` HttpOnly cookie. No
session without a valid cookie → 401, no fallback. **Guard:** the auth
middleware test (lands in the auth phase).

## 4. Never invented data

Types are generated from the frozen contract (ADR-0022). The mock and the UI
reflect exactly that shape and invent no fields, and no UI element implies a
capability the canon does not have (no fake multi-operator RBAC). **Guard:**
type generation from the contract + a shape test.

## 5. Never new control-plane state

The console projects what the control plane reports through an all-GET surface
and owns no mutable state. **Guard:** the all-GET read surface + the import
boundary.

## Activation rule for code-coupled gates

The coverage threshold (≥80%) and mutation gate (Stryker ≥60%) are code-coupled.
They are scaffolded report-only / deferred until the auth phase, where their
load-bearing code first exists, and are flipped to blocking there. A threshold
on an empty tree is theater, not a guard.
```

- [ ] **Step 2: Commit**

```bash
git add CONSTITUTION.md
git commit -m "docs: constitution — five 'never's, live from PR-1"
```

---

## Task 10: Append the working rules to CLAUDE.md

**Files:**
- Modify: `/Users/nick/ocu-admin/CLAUDE.md`

- [ ] **Step 1: Append a "Quality gates" section to CLAUDE.md**

Append (do not rewrite the existing file):

```markdown

## Quality gates (live from PR-1)

Local pre-commit run (all must pass):

    cd web && npm run typecheck && npm run lint && npm run format:check \
      && npm run depcruise && npm run knip && npm run sober && npm run test:cov

Blocking CI (`.github/workflows/ci.yml`): gitleaks (committed `.gitleaks.toml`),
semgrep (`scan --config p/typescript p/react p/nextjs p/owasp-top-ten --error`),
tsc `--noEmit`, eslint, prettier `--check`, dependency-cruiser import-boundary,
knip, sober (`--fail-on hungover`), vitest + v8 coverage (report-only until
source lands).

Forbidden: god files; empty `catch {}`; dead / commented-out code; duplication
instead of reuse; production stubs; a read-only client importing a mutating
authority; any UI element implying a capability the canon (ADR-0022) lacks.

New code ships with tests. The auth path and the import-boundary guard carry
≥60% mutation + ≥80% patch coverage once that code lands (auth phase). No gate
bypass.

Tool → language map (this is the only non-Go repo in the fleet — TypeScript /
Next.js tooling ONLY): knip, semgrep, Stryker, sober, vitest, eslint, tsc,
dependency-cruiser, prettier. NO Go / Rust / Python linters or mutation tools.

Coverage-threshold and mutation gates activate only once their app code is
cleared to land (auth phase) — see CONSTITUTION.md "Activation rule".
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: working-rules — quality gates, forbidden list, tool→language map"
```

---

## Task 11: Full local gate run + push + open PR-1 (HOLD)

- [ ] **Step 1: Run the full local gate suite green**

Run:
```bash
cd web && npm run typecheck && npm run lint && npm run format:check \
  && npm run depcruise && npm run knip && npm run sober && npm run test:cov
```
Expected: every command exits 0. Fix anything red before proceeding.

- [ ] **Step 2: Push the branch**

```bash
git push -u origin feat/scaffold-and-ci-gates
```

- [ ] **Step 3: Open PR-1 as ready, then HOLD**

```bash
gh pr create --title "feat: scaffold + CI gates + live constitution (PR-1)" \
  --body "<see PR body template below>"
```

PR body MUST include: the installed+pinned versions, the files added, the local
commands, the ambiguous-dead-code owner list (if any), the per-gate RED→green
proof (depcruise + bundle-secrecy shown; coverage/Stryker noted as
scaffolded/deferred to the auth phase), and a BEFORE/AFTER snapshot (dead
exports, semgrep findings, sober score, coverage %).

- [ ] **Step 4: HOLD for owner merge command**

Do NOT merge. Report the PR# to the architect; the owner says "сливай #N" before
any merge to public main. "gates green" is not authorization.

---

## Self-Review

- **Spec coverage:** scaffold (Task 2) ✓; import-boundary (Task 3) ✓;
  bundle-secrecy (Task 4) ✓; all PR-1 gates (Tasks 3–8) ✓; constitution live
  (Task 9, 10) ✓; deferred coverage/Stryker named (Task 6, 9) ✓; merge-discipline
  HOLD (Task 11) ✓. Auth, dashboard UI, mock-BFF, flip-to-real = later phases,
  out of this plan by design.
- **Placeholder scan:** version-verify notes (react/@types, sober flags) are
  explicit "verify at execution, do not float" guards, not silent TODOs.
- **Type consistency:** gate script names (`typecheck`/`lint`/`format:check`/
  `depcruise`/`knip`/`sober`/`test`/`test:cov`) match across package.json, CI,
  CLAUDE.md, and the plan.
