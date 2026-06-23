// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { loadAuthConfig } from "@/lib/auth/config"
import { verifyCredential } from "@/lib/auth/credential"
import { signSession } from "@/lib/auth/session"
import { serializeCookie, sessionCookieOptions } from "@/lib/auth/cookie"

// The only browser-to-server auth hop. On correct credentials it mints a
// stateless session token and sets it as the HttpOnly cookie; on anything else
// it returns 401 with no cookie and no detail (no username/password
// distinction leaked). This route never reads the control plane.

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(null, { status: 400 })
  }

  const { username, password } = (body ?? {}) as {
    username?: unknown
    password?: unknown
  }
  if (typeof username !== "string" || typeof password !== "string") {
    return new Response(null, { status: 400 })
  }

  const cfg = loadAuthConfig()
  const ok = await verifyCredential(
    username,
    password,
    cfg.operatorUser,
    cfg.operatorBcryptHash,
  )
  if (!ok) {
    return new Response(null, { status: 401 })
  }

  const token = await signSession(cfg.operatorUser, cfg.sessionSecret)
  return new Response(null, {
    status: 204,
    headers: { "set-cookie": serializeCookie(token, sessionCookieOptions()) },
  })
}
