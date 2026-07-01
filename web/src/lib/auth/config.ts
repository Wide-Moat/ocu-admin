// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// The single config point for the operator credential and session secret. All
// three come from the environment (ADR-0004 minimal shelf: host-rooted local
// operator credential, no IdP). The outward names are the compose-pinned
// OCU_ADMIN_* (prefixed so they do not collide with the control plane's operator
// creds in a shared compose env). There is NO fallback: a missing or unsafe
// value is a hard failure, never a default.

export type AuthConfig = {
  operatorUser: string
  operatorBcryptHash: string
  sessionSecret: string
}

// HS256 keys below 32 bytes are brute-forceable; refuse them.
const MIN_SECRET_BYTES = 32

type Env = Record<string, string | undefined>

export function loadAuthConfig(env: Env = process.env): AuthConfig {
  const operatorUser = required(env, "OCU_ADMIN_OPERATOR_USER")
  const operatorBcryptHash = required(env, "OCU_ADMIN_OPERATOR_BCRYPT_HASH")
  const sessionSecret = required(env, "OCU_ADMIN_SESSION_SECRET")

  // Measure the floor in BYTES, not `String.length` (UTF-16 code units): the
  // constant and the message speak of bytes, and a multi-byte secret carries
  // more bytes of entropy than its code-unit count. Buffer is part of the
  // Node server runtime, and this file is server-only config.
  if (Buffer.byteLength(sessionSecret, "utf8") < MIN_SECRET_BYTES) {
    throw new Error(
      `OCU_ADMIN_SESSION_SECRET must be at least ${MIN_SECRET_BYTES} bytes`,
    )
  }

  return { operatorUser, operatorBcryptHash, sessionSecret }
}

function required(env: Env, name: string): string {
  const value = env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}
