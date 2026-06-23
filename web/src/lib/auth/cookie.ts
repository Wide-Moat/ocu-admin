// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// The session cookie's security attributes, in one place so the login route and
// the middleware cannot disagree. SameSite=Strict because the console is its own
// top-level origin and is never embedded (ADR-0004); HttpOnly so script cannot
// read the token; Secure so it is never sent over plain HTTP.

export const SESSION_COOKIE = "ocu_admin_session"

// Seconds. Matches the 8h token TTL — the cookie never outlives the token.
const MAX_AGE = 8 * 60 * 60

type CookieOptions = {
  httpOnly: true
  sameSite: "strict"
  secure: true
  path: "/"
  maxAge: number
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    path: "/",
    maxAge: MAX_AGE,
  }
}

// Logout / invalidation: same attributes, maxAge 0 so the browser drops it.
export function clearedCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    path: "/",
    maxAge: 0,
  }
}

// Serialize to a Set-Cookie header value. Kept here so the attribute set and its
// wire form live together; route handlers emit a plain Web Response.
export function serializeCookie(
  value: string,
  opts: CookieOptions = sessionCookieOptions(),
): string {
  return [
    `${SESSION_COOKIE}=${value}`,
    `Path=${opts.path}`,
    `Max-Age=${opts.maxAge}`,
    `SameSite=${opts.sameSite.charAt(0).toUpperCase()}${opts.sameSite.slice(1)}`,
    opts.httpOnly ? "HttpOnly" : "",
    opts.secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ")
}
