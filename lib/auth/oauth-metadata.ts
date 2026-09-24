import { baseUrl } from '../env'
import { OAUTH_SCOPE } from './oauth'

export function resourceUrl(headers: Headers): string {
  return `${baseUrl(headers)}/api/mcp`
}

/** RFC 9728 – Protected Resource Metadata for the MCP endpoint. */
export function protectedResourceMetadata(headers: Headers) {
  const base = baseUrl(headers)
  return {
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: 'Lernraum',
    resource_documentation: `${base}/einstellungen#claude`,
  }
}

/** RFC 8414 – Authorization Server Metadata. */
export function authorizationServerMetadata(headers: Headers) {
  const base = baseUrl(headers)
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    scopes_supported: [OAUTH_SCOPE],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    revocation_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    code_challenge_methods_supported: ['S256'],
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${base}/einstellungen#claude`,
  }
}

export function metadataResponse(data: unknown): Response {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
