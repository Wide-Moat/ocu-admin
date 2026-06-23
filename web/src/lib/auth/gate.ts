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
  if (!token) {
    return false
  }
  try {
    await verifySession(token, secret)
    return true
  } catch {
    return false
  }
}
