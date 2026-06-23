// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { describe, it, expect } from "vitest"
import { signSession, verifySession } from "../session"

// Dummy HMAC key for tests only — not a credential. Named explicitly so a
// secret scanner does not flag it; an exclude-path is the second layer.
const SECRET = "DUMMY-NOT-A-REAL-SECRET-test-only-padding-0123456789"

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url")
}

describe("session verify — algorithm confusion", () => {
  it("rejects a forged alg:none token", async () => {
    // A real attacker hand-crafts an unsigned token claiming alg:none (jose's
    // own API refuses to mint one, so we build it by hand). The verifier MUST
    // reject it — never trust the token's self-declared algorithm.
    const header = b64url({ alg: "none", typ: "JWT" })
    const claims = b64url({
      sub: "operator",
      iat: Math.floor(0),
      exp: 9999999999,
    })
    const forged = `${header}.${claims}.` // empty signature

    await expect(verifySession(forged, SECRET)).rejects.toThrow()
  })

  it("rejects a token signed with a different HMAC algorithm (HS384)", async () => {
    // Algorithm pinning: even a *validly signed* token is rejected if its
    // algorithm is not the one allowed. This kills a widened-allowlist mutation,
    // which the empty-signature alg:none case alone does not catch (jose's
    // key-type guard rejects that for an unrelated reason).
    const { SignJWT } = await import("jose")
    const hs384 = await new SignJWT({})
      .setProtectedHeader({ alg: "HS384" })
      .setSubject("operator")
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(new TextEncoder().encode(SECRET))

    await expect(verifySession(hs384, SECRET)).rejects.toThrow()
  })
})

describe("session sign/verify round-trip", () => {
  it("verifies a token it just signed and returns the subject", async () => {
    const token = await signSession("operator", SECRET)
    const payload = await verifySession(token, SECRET)
    expect(payload.sub).toBe("operator")
  })

  it("stamps iat and exp on a signed token", async () => {
    const token = await signSession("operator", SECRET)
    const payload = await verifySession(token, SECRET)
    expect(typeof payload.iat).toBe("number")
    expect(typeof payload.exp).toBe("number")
    expect(payload.exp! - payload.iat!).toBeGreaterThan(0)
  })

  it("rejects a token signed with a different secret", async () => {
    const token = await signSession("operator", SECRET)
    await expect(
      verifySession(token, "DUMMY-DIFFERENT-test-only-key-0123456789abcd"),
    ).rejects.toThrow()
  })

  it("rejects a token whose payload was tampered with", async () => {
    const token = await signSession("operator", SECRET)
    const [header, , signature] = token.split(".")
    const tampered = b64url({ sub: "attacker", iat: 0, exp: 9999999999 })
    await expect(
      verifySession(`${header}.${tampered}.${signature}`, SECRET),
    ).rejects.toThrow()
  })

  it("rejects an expired token", async () => {
    // Sign a token already past its exp via a tiny TTL, then verify after it
    // lapses. jose enforces exp; an operator's stale session must not pass.
    const expired = await new (await import("jose")).SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("operator")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 100)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(new TextEncoder().encode(SECRET))
    await expect(verifySession(expired, SECRET)).rejects.toThrow()
  })
})
