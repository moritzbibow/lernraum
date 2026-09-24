import { clientIp, rateLimit } from '@/lib/auth/rate-limit'
import { OAuthError, registerClient } from '@/lib/auth/oauth'
import { corsPreflight, oauthErrorResponse, oauthJson } from '@/lib/auth/oauth-http'

export const dynamic = 'force-dynamic'

/** RFC 7591 Dynamic Client Registration (redirect URIs are allow-listed). */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`register:${clientIp(req.headers)}`, 20, 60 * 60 * 1000).ok) {
      throw new OAuthError('slow_down', 'Zu viele Registrierungen. Bitte später erneut versuchen.', 429)
    }
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') throw new OAuthError('invalid_client_metadata', 'JSON-Body erwartet.')
    return oauthJson(registerClient(body), 201)
  } catch (e) {
    return oauthErrorResponse(e)
  }
}

export const OPTIONS = corsPreflight
