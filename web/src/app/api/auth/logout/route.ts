// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { clearedCookieOptions, serializeCookie } from "@/lib/auth/cookie"

// Ends the operator session by clearing the HttpOnly cookie. The middleware
// gates this route, so reaching the handler already proves identity — logout is
// therefore unconditional: it reads no body, no config, and no control-plane
// state. It emits an empty Set-Cookie with Max-Age=0 so the browser drops the
// token, then returns 204. POST (not GET) so a stale prefetch or cross-site
// link cannot silently end the session.

export async function POST(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: { "set-cookie": serializeCookie("", clearedCookieOptions()) },
  })
}
