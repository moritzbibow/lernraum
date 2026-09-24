import { clientIp, rateLimit } from '@/lib/auth/rate-limit'
import { exchangeAuthorizationCode, OAuthError, refreshAccessToken } from '@/lib/auth/oauth'
import { clientCredentials, corsPreflight, oauthErrorResponse, oauthJson, readParams } from '@/lib/auth/oauth-http'

export const dynamic = 'force-dynamic'

/** Token endpoint: authorization_code (+PKCE) and refresh_token grants. */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`token:${clientIp(req.headers)}`, 60, 60 * 1000).ok) {
      throw new OAuthError('slow_down', 'Zu viele Anfragen.', 429)
    }
    const params = await readParams(req)
    const { clientId, clientSecret } = clientCredentials(req, params)
    if (params.grant_type === 'authorization_code') {
      if (!params.code) throw new OAuthError('invalid_request', 'code fehlt.')
      if (!clientId) throw new OAuthError('invalid_client', 'client_id fehlt.', 401)
      return oauthJson(
        exchangeAuthorizationCode({
          code: params.code,
          clientId,
          clientSecret,
          redirectUri: params.redirect_uri ?? null,
          codeVerifier: params.code_verifier ?? null,
        }),
      )
    }
    if (params.grant_type === 'refresh_token') {
      if (!params.refresh_token) throw new OAuthError('invalid_request', 'refresh_token fehlt.')
      return oauthJson(refreshAccessToken({ refreshToken: params.refresh_token, clientId, clientSecret }))
    }
    throw new OAuthError('unsupported_grant_type', 'Unterstützt: authorization_code, refresh_token.')
  } catch (e) {
    return oauthErrorResponse(e)
  }
}

export const OPTIONS = corsPreflight
