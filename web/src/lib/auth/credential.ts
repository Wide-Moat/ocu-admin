// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import bcrypt from "bcryptjs"

// OWASP ASVS V2.4 bcrypt cost. OWASP's 2024 floor is 10; 12 is chosen with
// margin. The config hash MUST be generated at this cost (the credential test
// pins it).
export const BCRYPT_COST = 12

// Constant-time string compare so a username match/mismatch does not leak via
// timing. A length mismatch returns early — a session-token / username length is
// not secret, so this is acceptable and not a timing oracle. For equal-length
// inputs the loop runs a fixed bound over ALL bytes, accumulating the XOR diff
// without ever branching or returning mid-loop, so WHERE the first byte differs
// never leaks. A single final 0-check decides equality.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  if (ab.length !== bb.length) {
    return false
  }
  // Equal length ⇒ every index is in-bounds; no masking is needed. The bound is
  // exactly the compared length and the body touches every byte unconditionally.
  let diff = 0
  // Stryker disable next-line EqualityOperator: equivalent mutant. `i < n` -> `i
  // <= n` over two EQUAL-length buffers reads index n on both sides, and a JS
  // typed-array out-of-bounds read yields `undefined` on both, so the extra
  // iteration contributes `undefined ^ undefined === 0`. Killing it would need a
  // data-dependent branch (or unequal-length padding) that breaks the
  // constant-time guarantee — the higher invariant this function exists to hold.
  for (let i = 0; i < ab.length; i++) {
    diff |= ab[i] ^ bb[i]
  }
  return diff === 0
}

// Verify the single operator credential: the input must match BOTH the
// configured username and the bcrypt-hashed password. bcrypt.compare always
// runs (even on a username mismatch) so the response time does not reveal
// whether the username was correct.
export async function verifyCredential(
  inputUser: string,
  inputPassword: string,
  expectedUser: string,
  expectedHash: string,
): Promise<boolean> {
  const userOk = timingSafeEqual(inputUser, expectedUser)
  const passwordOk = await bcrypt.compare(inputPassword, expectedHash)
  return userOk && passwordOk
}
