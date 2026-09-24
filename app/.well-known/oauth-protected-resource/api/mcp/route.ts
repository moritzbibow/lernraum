import { metadataResponse, protectedResourceMetadata } from '@/lib/auth/oauth-metadata'

export const dynamic = 'force-dynamic'

export function GET(req: Request) {
  return metadataResponse(protectedResourceMetadata(req.headers))
}
