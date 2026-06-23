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

export async function verifySession(
  token: string,
  secret: string,
): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, key(secret), {
    algorithms: [ALG],
  })
  return payload
}
