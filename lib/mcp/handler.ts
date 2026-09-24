import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { Principal } from '../auth/api-auth'
import { baseUrl } from '../env'
import { createMcpServer } from './server'

/** Stateless Streamable HTTP: a fresh server + transport per request, JSON responses. */
export async function handleMcpRequest(req: Request, principal: Principal): Promise<Response> {
  const server = createMcpServer({ baseUrl: baseUrl(req.headers) })
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  try {
    return await transport.handleRequest(req, {
      authInfo: { token: principal.via, clientId: principal.clientId ?? principal.via, scopes: ['lernraum'] },
    })
  } finally {
    // JSON mode: the response body is complete at this point.
    void transport.close()
    void server.close()
  }
}

export function mcpUnauthorized(req: Request): Response {
  const base = baseUrl(req.headers)
  const hasToken = Boolean(req.headers.get('authorization'))
  return new Response(
    JSON.stringify({
      error: hasToken ? 'invalid_token' : 'unauthorized',
      error_description: 'Anmeldung erforderlich (OAuth über den Connector oder Authorization: Bearer <LERNRAUM_API_TOKEN>).',
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer realm="lernraum", resource_metadata="${base}/.well-known/oauth-protected-resource/api/mcp"${hasToken ? ', error="invalid_token"' : ''}`,
      },
    },
  )
}
