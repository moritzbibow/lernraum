import { revokeToken } from '@/lib/auth/oauth'
import { corsPreflight, oauthJson, readParams } from '@/lib/auth/oauth-http'

export const dynamic = 'force-dynamic'

/** RFC 7009 – always 200, even for unknown tokens. */
export async function POST(req: Request) {
  const params = await readParams(req)
  if (params.token) revokeToken(params.token)
  return oauthJson({})
}

export const OPTIONS = corsPreflight
