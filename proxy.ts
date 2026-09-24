import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from './lib/auth/session-core'
import { baseUrl } from './lib/env'

/*
 * Auth gate for the UI. API routes, OAuth endpoints and discovery documents
 * authenticate themselves (bearer tokens), so they pass through here.
 */

const PUBLIC: RegExp[] = [
  /^\/login$/,
  /^\/api\//,
  /^\/\.well-known\//,
  /^\/oauth\/(token|register|revoke)$/,
  /^\/(favicon\.ico|icon[^/]*|apple-icon[^/]*|robots\.txt|manifest\.webmanifest)$/,
]

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const headers = new Headers(req.headers)
  headers.set('x-lernraum-path', pathname + search)

  const isPublic = PUBLIC.some((re) => re.test(pathname))
  if (!isPublic && !verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) {
    // PUBLIC_URL (or the forwarded host) keeps the redirect on https behind Traefik.
    const target = new URL(`/login?next=${encodeURIComponent(pathname + search)}`, baseUrl(req.headers))
    return NextResponse.redirect(target, 307)
  }
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
