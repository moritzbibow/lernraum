import { OAuthError } from './oauth'

export function oauthJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export function oauthErrorResponse(e: unknown): Response {
  if (e instanceof OAuthError) {
    const headers: Record<string, string> = {}
    const res = oauthJson(e.toJSON(), e.status)
    if (e.status === 401) {
      Object.assign(headers, { 'WWW-Authenticate': 'Basic realm="lernraum"' })
      return new Response(res.body, { status: 401, headers: { ...Object.fromEntries(res.headers), ...headers } })
    }
    return res
  }
  console.error('[lernraum] OAuth-Fehler:', e)
  return oauthJson({ error: 'server_error', error_description: 'Interner Fehler.' }, 500)
}

/** Reads form-encoded (standard) or JSON bodies. */
export async function readParams(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get('content-type') ?? ''
  if (type.includes('application/json')) {
    const data = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return Object.fromEntries(Object.entries(data).filter(([, v]) => typeof v === 'string')) as Record<string, string>
  }
  const text = await req.text()
  return Object.fromEntries(new URLSearchParams(text))
}

/** Client credentials from HTTP Basic auth or the body. */
export function clientCredentials(req: Request, params: Record<string, string>): { clientId: string | null; clientSecret: string | null } {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8')
      const i = decoded.indexOf(':')
      if (i > 0) {
        return { clientId: decodeURIComponent(decoded.slice(0, i)), clientSecret: decodeURIComponent(decoded.slice(i + 1)) }
      }
    } catch {
      // fall through
    }
  }
  return { clientId: params.client_id ?? null, clientSecret: params.client_secret ?? null }
}

export function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
