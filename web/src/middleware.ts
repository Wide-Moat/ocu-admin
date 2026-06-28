// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import { NextResponse, type NextRequest } from "next/server"
import { loadAuthConfig } from "@/lib/auth/config"
import { isAuthorized } from "@/lib/auth/gate"
import { SESSION_COOKIE } from "@/lib/auth/cookie"

// The gate: every matched request must carry a valid session cookie, or it gets
// 401 with no fallback. The login route is the one unauthenticated entry (you
// cannot log in if the gate blocks the login call). The authorization decision
// itself lives in isAuthorized (unit-tested); this shell only wires it to Next.

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const { sessionSecret } = loadAuthConfig()

  if (await isAuthorized(token, sessionSecret)) {
    return NextResponse.next()
  }
  return new NextResponse(null, { status: 401 })
}

export const config = {
  // Gate everything except the login route, Next internals, and static assets.
  // The login POST must stay reachable unauthenticated.
  matcher: ["/((?!api/auth/login|_next/static|_next/image|favicon.ico).*)"],
}
