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
carries no socket path or credential. The browser never dials the control
plane. **Guard:** the bundle-secrecy test (no UDS marker in the client tree).

## 3. Never anonymous

A bcrypt-verified operator credential + a `SameSite=Strict` HttpOnly cookie. No
session without a valid cookie → 401, no fallback. **Guard:** the auth
middleware test (lands in the auth phase).

## 4. Never invented data, never ahead of canon

The console reads no data source that the canon has not ratified. Types are
generated from the operator read-surface contract **only once that contract is
accepted on `next/v1`** (ADR-0022); until then the contract shape is not frozen,
the only data source is a checked-in fixture, and nothing renders a live source.
The mock and the UI reflect exactly the contract shape and invent no fields; no
UI element implies a capability the canon does not have (no fake multi-operator
RBAC), and no tile derives a stat the schema cannot supply. **Guard:** the
hard-ordering gate below + type generation from the contract + a shape test.

## 5. Never new control-plane state

The console projects what the control plane reports through an all-GET surface
and owns no mutable state. **Guard:** the all-GET read surface + the import
boundary.

## Hard ordering (the unblock signal)

This console MUST NOT read a non-canon source. The operator read surface and its
named read identity must be **accepted on `next/v1`** in the architecture repo
before any code here reads them:

- The read-surface contract (all-GET operator read-API behind a BFF) is **ADR-0022**.
- The operator read-identity substrate (host-rooted local operator credential)
  is **ADR-0004**.

Until **both are accepted on `next/v1`**, read-surface-dependent phases stay
gated. The repo treats "ADR-0022 accepted on `next/v1`" as the unblock signal.
A local note calling the contract "frozen" does not override this; canon status
on `next/v1` is the source of truth.

Hard-ordering-safe work (buildable now, reads no live/non-canon source): the
auth substrate (§3), the CI gates (§1, §2), a static external Grafana link tile,
docs, and a fixture-only UI shell (renders a checked-in fixture, never a live
source).

## Activation rule for code-coupled gates

The coverage threshold (≥80%) and mutation gate (Stryker ≥60%) are code-coupled.
They are scaffolded report-only / deferred until the auth phase, where their
load-bearing code first exists, and are flipped to blocking there. A threshold
on an empty tree is theater, not a guard.

## Verification discipline

**Exit criteria are verified on a clean tree firsthand.** `git stash -u` and run
each gate on an untouched checkout. Never declare a criterion met because a plan
says so. A gate that is red on a clean checkout while the criterion claims "all
exit 0" is a fake guard; this surfaces when CI runs what a developer claimed was
green.

**Every security guard is proven non-vacuous by hand-mutation.** Flip the guard
(e.g. inject a contrived violation into the rule's domain), run the gate, and
watch it go RED. Revert the mutation and confirm green again. A green test that
survives a mutation of the thing it guards does not count as a guard; it is a
vacuous test. Vacuous gates do not prevent the thing they claim to prevent.
