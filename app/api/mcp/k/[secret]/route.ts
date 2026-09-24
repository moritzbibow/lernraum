import { checkUrlSecret } from '@/lib/auth/api-auth'
import { handleMcpRequest } from '@/lib/mcp/handler'

export const dynamic = 'force-dynamic'

/**
 * Fallback: MCP under a secret URL (…/api/mcp/k/<MCP_URL_SECRET>) for clients
 * that cannot do OAuth. Disabled unless MCP_URL_SECRET is set.
 */
async function handler(req: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params
  if (!checkUrlSecret(secret)) return new Response('Not found', { status: 404 })
  return handleMcpRequest(req, { via: 'url-secret' })
}

export { handler as GET, handler as POST, handler as DELETE }
