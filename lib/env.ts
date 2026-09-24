import { createHash, randomBytes } from 'node:crypto'

/*
 * Runtime configuration. Read lazily (never at module load) so that values come
 * from the container environment at runtime, not from the build.
 */

const isProd = () => process.env.NODE_ENV === 'production'

export function appPassword(): string | null {
  const pw = process.env.APP_PASSWORD
  if (pw && pw.length > 0) return pw
  return isProd() ? null : 'lernraum' // local development default
}

const g = globalThis as unknown as { __lernraumDevSecret?: string }

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (secret && secret.length >= 16) return secret
  if (isProd()) throw new Error('SESSION_SECRET fehlt oder ist zu kurz (mindestens 16 Zeichen).')
  g.__lernraumDevSecret ??= randomBytes(32).toString('hex')
  return g.__lernraumDevSecret
}

/** Static bearer token for REST/Claude Code. Optional. */
export function apiToken(): string | null {
  const token = process.env.LERNRAUM_API_TOKEN
  return token && token.length >= 16 ? token : null
}

/** Optional fallback: MCP reachable under /api/mcp/k/<secret> without OAuth. */
export function mcpUrlSecret(): string | null {
  const s = process.env.MCP_URL_SECRET
  return s && s.length >= 24 ? s : null
}

export function userName(): string {
  return process.env.APP_USER_NAME?.trim() || 'Moritz'
}

/** First name for the greeting ("Guten Abend, Moritz."). */
export function firstName(): string {
  return userName().split(/\s+/)[0]
}

export function publicUrl(): string | null {
  const url = process.env.PUBLIC_URL?.trim().replace(/\/+$/, '')
  return url || null
}

/** Absolute base URL: PUBLIC_URL, else derived from the (proxied) request. */
export function baseUrl(headers?: Headers): string {
  const env = publicUrl()
  if (env) return env
  if (headers) {
    const host = headers.get('x-forwarded-host') ?? headers.get('host')
    if (host) {
      const proto =
        headers.get('x-forwarded-proto')?.split(',')[0].trim() ??
        (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? 'http' : 'https')
      return `${proto}://${host}`
    }
  }
  return 'http://localhost:3000'
}

/** Changes whenever the password changes → old sessions become invalid. */
export function passwordFingerprint(): string {
  return createHash('sha256').update(`lernraum:${appPassword() ?? ''}`).digest('hex').slice(0, 16)
}

export function oauthRedirectAllowlist(): string[] {
  const extra = (process.env.OAUTH_ALLOWED_REDIRECTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return ['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback', ...extra]
}

export function secureCookies(): boolean {
  if (process.env.COOKIE_SECURE === '0') return false
  if (process.env.COOKIE_SECURE === '1') return true
  const url = publicUrl()
  return url ? url.startsWith('https://') : isProd()
}
