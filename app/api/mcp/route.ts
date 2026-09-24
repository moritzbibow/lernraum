import { authenticate } from '@/lib/auth/api-auth'
import { handleMcpRequest, mcpUnauthorized } from '@/lib/mcp/handler'

export const dynamic = 'force-dynamic'

/** MCP endpoint for Claude (Streamable HTTP). Auth: OAuth access token or LERNRAUM_API_TOKEN. */
async function handler(req: Request) {
  const principal = authenticate(req)
  if (!principal) return mcpUnauthorized(req)
  return handleMcpRequest(req, principal)
}

export { handler as GET, handler as POST, handler as DELETE }
