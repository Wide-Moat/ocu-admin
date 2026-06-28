// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { SignJWT, jwtVerify, type JWTPayload } from "jose"

// The operator session is a stateless signed token (ADR-0004 minimal shelf):
// no server-side store, HS256, secret from env. The console is a read-only leaf
// that owns no mutable state, so a stateless token is the right fit and survives
// a restart with zero external dependency.

// Only HS256 is ever accepted. Pinning the allowlist is what rejects an
// `alg:none` (or any other algorithm) forgery — never trust a token's
// self-declared header algorithm.
const ALG = "HS256"

// An operator shift; logout is expiry (single-operator, instant revoke is the
// out-of-band kill switch per ADR-0004).
const TTL = "8h"

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

export async function signSession(
  subject: string,
  secret: string,
): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(key(secret))
}

// `token` is intentionally `string | undefined`: after the gate stopped
// pre-guarding the missing-token case, an absent cookie reaches here directly.
// jwtVerify throws `JWSInvalid` on an undefined token (verified firsthand), so
// the cast satisfies `tsc` WITHOUT adding an inner undefined-guard that would be
// VACUOUS: any such guard is equivalent to jose's own rejection — removing it
// would change no observable behaviour and would survive mutation (the exact
// dead-guard removed from the gate). The undefined-rejection is real and
// enforced, just at the jose layer, not via a separate killable inner guard. It
// is tested where it CAN be killed (the gate-level `isAuthorized(undefined)` ->
// false test) and pinned as a jose contract by a `verifySession(undefined)
// rejects` test, so a future jose that stops throwing on undefined surfaces.
export async function verifySession(
  token: string | undefined,
  secret: string,
): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token as string, key(secret), {
    algorithms: [ALG],
  })
  return payload
}
