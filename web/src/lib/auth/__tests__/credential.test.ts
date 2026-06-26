// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect } from "vitest"
import bcrypt from "bcryptjs"
import { verifyCredential, BCRYPT_COST } from "../credential"

// A bcrypt hash of "correct-horse" at the pinned cost, generated in-test so the
// fixture cannot drift from BCRYPT_COST.
const USER = "operator"
const PASSWORD = "correct-horse-battery-staple"

describe("operator credential verify", () => {
  it("accepts the correct user and password", async () => {
    const hash = await bcrypt.hash(PASSWORD, BCRYPT_COST)
    await expect(verifyCredential(USER, PASSWORD, USER, hash)).resolves.toBe(
      true,
    )
  })

  it("rejects a wrong password", async () => {
    const hash = await bcrypt.hash(PASSWORD, BCRYPT_COST)
    await expect(
      verifyCredential(USER, "wrong-password", USER, hash),
    ).resolves.toBe(false)
  })

  it("rejects a wrong username", async () => {
    const hash = await bcrypt.hash(PASSWORD, BCRYPT_COST)
    await expect(
      verifyCredential("intruder", PASSWORD, USER, hash),
    ).resolves.toBe(false)
  })

  it("rejects a username of a different length (constant-time path)", async () => {
    const hash = await bcrypt.hash(PASSWORD, BCRYPT_COST)
    // A shorter input exercises the unequal-length branch of the timing-safe
    // compare; it must still reject without short-circuiting.
    await expect(verifyCredential("op", PASSWORD, USER, hash)).resolves.toBe(
      false,
    )
  })

  // The two cases below pin the rewritten timingSafeEqual against the mutants
  // that survived the old `?? 0` form. A differing-LENGTH input and a
  // same-LENGTH differing-BYTE input must BOTH reject. If the loop bound were
  // mutated (e.g. `<` -> `<=`) or the length pre-check dropped, one of these
  // would flip and fail — so each is a kill-test.
  it("rejects a differing-length username (kills the length-bound mutant)", async () => {
    const hash = await bcrypt.hash(PASSWORD, BCRYPT_COST)
    // "operator" is 8 bytes; "operators" is 9 — same prefix, one byte longer.
    await expect(
      verifyCredential("operators", PASSWORD, USER, hash),
    ).resolves.toBe(false)
    // And one byte shorter, "operato", to exercise the other length direction.
    await expect(
      verifyCredential("operato", PASSWORD, USER, hash),
    ).resolves.toBe(false)
  })

  it("rejects a same-length username differing by one byte (kills the byte-compare mutant)", async () => {
    const hash = await bcrypt.hash(PASSWORD, BCRYPT_COST)
    // "operator" -> "operatoR": identical length, a single differing byte in
    // the final position. Must reject; the loop must touch the last byte.
    await expect(
      verifyCredential("operatoR", PASSWORD, USER, hash),
    ).resolves.toBe(false)
    // A differing byte in the FIRST position too, same length.
    await expect(
      verifyCredential("Xperator", PASSWORD, USER, hash),
    ).resolves.toBe(false)
  })

  it("uses a bcrypt cost factor of at least 12 (OWASP ASVS V2.4)", () => {
    expect(BCRYPT_COST).toBeGreaterThanOrEqual(12)
  })

  it("produces hashes that encode the pinned cost", async () => {
    // A bcrypt hash is $2<x>$<cost>$... — the cost segment must be BCRYPT_COST.
    const hash = await bcrypt.hash(PASSWORD, BCRYPT_COST)
    const cost = Number(hash.split("$")[2])
    expect(cost).toBe(BCRYPT_COST)
  })
})
