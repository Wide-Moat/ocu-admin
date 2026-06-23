// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import bcrypt from "bcryptjs"

// OWASP ASVS V2.4 bcrypt cost. OWASP's 2024 floor is 10; 12 is chosen with
// margin. The config hash MUST be generated at this cost (the credential test
// pins it).
export const BCRYPT_COST = 12

// Constant-time string compare so a username match/mismatch does not leak via
// timing. Compares the full length regardless of where the first difference is.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  // XOR the lengths in so unequal-length inputs still differ, without an early
  // length-based return.
  let diff = ab.length ^ bb.length
  const max = Math.max(ab.length, bb.length)
  for (let i = 0; i < max; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0)
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
