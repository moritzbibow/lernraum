import { authorizationServerMetadata, metadataResponse } from '@/lib/auth/oauth-metadata'

export const dynamic = 'force-dynamic'

export function GET(req: Request) {
  return metadataResponse(authorizationServerMetadata(req.headers))
}
