import { apiToken, mcpUrlSecret } from '../env'
import { safeEqual } from './crypto'
import { verifyAccessToken } from './oauth'
import { SESSION_COOKIE, verifySessionToken } from './session-core'

export type Principal = { via: 'token' | 'oauth' | 'session' | 'url-secret'; clientId?: string }

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get('authorization')
  if (!h) return null
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

/** Bearer (static API token or OAuth access token), optionally the UI session cookie. */
export function authenticate(req: Request, opts: { allowSession?: boolean } = {}): Principal | null {
  const token = bearerToken(req)
  if (token) {
    const staticToken = apiToken()
    if (staticToken && safeEqual(token, staticToken)) return { via: 'token' }
    const oauth = verifyAccessToken(token)
    if (oauth) return { via: 'oauth', clientId: oauth.clientId }
    return null
  }
  if (opts.allowSession && verifySessionToken(readCookie(req.headers.get('cookie'), SESSION_COOKIE))) {
    return { via: 'session' }
  }
  return null
}

export function checkUrlSecret(secret: string): boolean {
  const expected = mcpUrlSecret()
  return Boolean(expected && safeEqual(secret, expected))
}
