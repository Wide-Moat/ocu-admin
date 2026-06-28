// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { verifySession } from "./session"

// The authorization decision, isolated from the Next.js middleware shell so it
// is unit-testable. A request is authorized only if it carries a session token
// that verifies against the secret. Anything else — missing token, bad
// signature, wrong algorithm, expired — is unauthorized. No fallback.
export async function isAuthorized(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  // No explicit missing-token guard: verifySession throws on an undefined or
  // empty token, and the catch returns false — so the absent case is already
  // unauthorized through the same path as a bad/forged token. An early return
  // here would be dead code (a surviving mutant), so it is intentionally gone.
  try {
    await verifySession(token, secret)
    return true
  } catch {
    return false
  }
}
