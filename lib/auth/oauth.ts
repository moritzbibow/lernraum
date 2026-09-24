import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { getDb } from '../db/client'
import { oauthClients, oauthCodes, oauthTokens } from '../db/schema'
import { oauthRedirectAllowlist } from '../env'
import { newId, newSecret } from '../ids'
import { safeEqual, sha256 } from './crypto'
import { createHash } from 'node:crypto'

/*
 * Minimal OAuth 2.1 authorization server for the MCP connector (claude.ai,
 * Claude Desktop, Claude Code): dynamic client registration (RFC 7591),
 * authorization code + PKCE S256, refresh-token rotation, revocation.
 * Only hashes of codes and tokens are stored.
 */

export const OAUTH_SCOPE = 'lernraum'
const ACCESS_TTL = 60 * 60 * 1000
const REFRESH_TTL = 90 * 24 * 60 * 60 * 1000
const CODE_TTL = 10 * 60 * 1000
/** A just-rotated refresh token keeps working briefly (lost responses, retries). */
const REFRESH_GRACE = 2 * 60 * 1000

export class OAuthError extends Error {
  constructor(
    public readonly error: string,
    public readonly description: string,
    public readonly status = 400,
  ) {
    super(description)
  }
  toJSON() {
    return { error: this.error, error_description: this.description }
  }
}

/* ------------------------------------------------------------------ */
/* Redirect URIs                                                        */
/* ------------------------------------------------------------------ */

export function isAllowedRedirectUri(uri: string): boolean {
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return false
  }
  if (url.hash) return false
  // Loopback redirects for native apps (Claude Code, Claude Desktop) – RFC 8252.
  if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]')) {
    return true
  }
  return oauthRedirectAllowlist().some((allowed) => allowed === uri)
}

/* ------------------------------------------------------------------ */
/* Clients                                                              */
/* ------------------------------------------------------------------ */

export type ClientRegistration = {
  redirect_uris?: unknown
  client_name?: unknown
  token_endpoint_auth_method?: unknown
  grant_types?: unknown
  response_types?: unknown
  scope?: unknown
}

export function registerClient(meta: ClientRegistration) {
  const uris = Array.isArray(meta.redirect_uris) ? meta.redirect_uris.filter((u): u is string => typeof u === 'string') : []
  if (uris.length === 0) throw new OAuthError('invalid_redirect_uri', 'redirect_uris fehlt.')
  const bad = uris.find((u) => !isAllowedRedirectUri(u))
  if (bad) {
    throw new OAuthError(
      'invalid_redirect_uri',
      `Redirect-URI nicht erlaubt: ${bad}. Erlaubt sind claude.ai/claude.com-Callbacks, localhost und OAUTH_ALLOWED_REDIRECTS.`,
    )
  }
  const method = typeof meta.token_endpoint_auth_method === 'string' ? meta.token_endpoint_auth_method : 'none'
  if (!['none', 'client_secret_post', 'client_secret_basic'].includes(method)) {
    throw new OAuthError('invalid_client_metadata', `token_endpoint_auth_method "${method}" wird nicht unterstützt.`)
  }
  const name = typeof meta.client_name === 'string' && meta.client_name.trim() ? meta.client_name.trim().slice(0, 100) : 'MCP-Client'
  const id = `lr_client_${newId(16)}`
  const secret = method === 'none' ? null : newSecret('lr_cs_', 32)
  const now = Date.now()
  getDb()
    .insert(oauthClients)
    .values({ id, name, redirectUris: uris, secretHash: secret ? sha256(secret) : null, createdAt: now })
    .run()
  return {
    client_id: id,
    client_id_issued_at: Math.floor(now / 1000),
    client_name: name,
    redirect_uris: uris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: method,
    scope: OAUTH_SCOPE,
    ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
  }
}

export function getClient(clientId: string) {
  return getDb().select().from(oauthClients).where(eq(oauthClients.id, clientId)).get() ?? null
}

function authenticateClient(clientId: string, clientSecret: string | null) {
  const client = getClient(clientId)
  if (!client) throw new OAuthError('invalid_client', 'Unbekannter Client.', 401)
  if (client.secretHash) {
    if (!clientSecret || !safeEqual(sha256(clientSecret), client.secretHash)) {
      throw new OAuthError('invalid_client', 'Client-Authentifizierung fehlgeschlagen.', 401)
    }
  }
  return client
}

/* ------------------------------------------------------------------ */
/* Authorization request                                                */
/* ------------------------------------------------------------------ */

export type AuthorizeParams = {
  response_type?: string | null
  client_id?: string | null
  redirect_uri?: string | null
  code_challenge?: string | null
  code_challenge_method?: string | null
  state?: string | null
  scope?: string | null
  resource?: string | null
}

export type ValidAuthorizeRequest = {
  client: { id: string; name: string }
  redirectUri: string
  codeChallenge: string
  state: string | null
  scope: string
  resource: string | null
}

export type AuthorizeValidation =
  | { ok: true; request: ValidAuthorizeRequest }
  /** Errors that must not be redirected (unknown client / bad redirect_uri). */
  | { ok: false; redirectable: false; error: string; description: string }
  | { ok: false; redirectable: true; redirectUri: string; state: string | null; error: string; description: string }

export function validateAuthorizeRequest(p: AuthorizeParams, expectedResources: string[]): AuthorizeValidation {
  const client = p.client_id ? getClient(p.client_id) : null
  if (!client) return { ok: false, redirectable: false, error: 'invalid_client', description: 'Unbekannter Client (client_id).' }
  const redirectUri = p.redirect_uri ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : null)
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return { ok: false, redirectable: false, error: 'invalid_request', description: 'redirect_uri passt nicht zum registrierten Client.' }
  }
  const fail = (error: string, description: string): AuthorizeValidation => ({
    ok: false,
    redirectable: true,
    redirectUri,
    state: p.state ?? null,
    error,
    description,
  })
  if (p.response_type !== 'code') return fail('unsupported_response_type', 'Nur response_type=code wird unterstützt.')
  if (!p.code_challenge || (p.code_challenge_method ?? 'plain') !== 'S256') {
    return fail('invalid_request', 'PKCE mit code_challenge_method=S256 ist erforderlich.')
  }
  const requested = (p.scope ?? '').split(/\s+/).filter(Boolean)
  if (requested.some((s) => s !== OAUTH_SCOPE)) return fail('invalid_scope', `Unbekannter Scope. Erlaubt: ${OAUTH_SCOPE}`)
  if (p.resource && !expectedResources.includes(p.resource.replace(/\/+$/, ''))) {
    return fail('invalid_target', 'Unbekannte resource.')
  }
  return {
    ok: true,
    request: {
      client: { id: client.id, name: client.name },
      redirectUri,
      codeChallenge: p.code_challenge,
      state: p.state ?? null,
      scope: OAUTH_SCOPE,
      resource: p.resource ?? null,
    },
  }
}

export function createAuthorizationCode(req: ValidAuthorizeRequest): string {
  const code = newSecret('lr_code_', 32)
  getDb()
    .insert(oauthCodes)
    .values({
      codeHash: sha256(code),
      clientId: req.client.id,
      redirectUri: req.redirectUri,
      codeChallenge: req.codeChallenge,
      scope: req.scope,
      resource: req.resource,
      expiresAt: Date.now() + CODE_TTL,
    })
    .run()
  return code
}

export function buildRedirect(redirectUri: string, params: Record<string, string | null | undefined>): string {
  const url = new URL(redirectUri)
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v)
  return url.toString()
}

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

export type TokenResponse = {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token: string
  scope: string
}

function pkceMatches(verifier: string, challenge: string): boolean {
  const computed = createHash('sha256').update(verifier).digest('base64url')
  return safeEqual(computed, challenge)
}

function issueTokens(clientId: string, scope: string, resource: string | null): TokenResponse {
  const access = newSecret('lr_at_', 32)
  const refresh = newSecret('lr_rt_', 32)
  const now = Date.now()
  getDb()
    .insert(oauthTokens)
    .values({
      id: newId(),
      clientId,
      accessHash: sha256(access),
      refreshHash: sha256(refresh),
      scope,
      resource,
      accessExpiresAt: now + ACCESS_TTL,
      refreshExpiresAt: now + REFRESH_TTL,
      createdAt: now,
    })
    .run()
  getDb().update(oauthClients).set({ lastUsedAt: now }).where(eq(oauthClients.id, clientId)).run()
  return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL / 1000, refresh_token: refresh, scope }
}

export function exchangeAuthorizationCode(p: {
  code: string
  clientId: string
  clientSecret: string | null
  redirectUri: string | null
  codeVerifier: string | null
}): TokenResponse {
  const client = authenticateClient(p.clientId, p.clientSecret)
  const db = getDb()
  const row = db.select().from(oauthCodes).where(eq(oauthCodes.codeHash, sha256(p.code))).get()
  if (!row || row.clientId !== client.id) throw new OAuthError('invalid_grant', 'Code ungültig.')
  if (row.usedAt) {
    // Code replay: revoke everything issued to this client since the code was created.
    db.update(oauthTokens).set({ revokedAt: Date.now() }).where(eq(oauthTokens.clientId, client.id)).run()
    throw new OAuthError('invalid_grant', 'Code wurde bereits verwendet.')
  }
  if (row.expiresAt < Date.now()) throw new OAuthError('invalid_grant', 'Code abgelaufen.')
  if (p.redirectUri && p.redirectUri !== row.redirectUri) throw new OAuthError('invalid_grant', 'redirect_uri passt nicht.')
  if (!p.codeVerifier || !pkceMatches(p.codeVerifier, row.codeChallenge)) {
    throw new OAuthError('invalid_grant', 'PKCE-Prüfung fehlgeschlagen (code_verifier).')
  }
  db.update(oauthCodes).set({ usedAt: Date.now() }).where(eq(oauthCodes.codeHash, row.codeHash)).run()
  return issueTokens(client.id, row.scope, row.resource)
}

export function refreshAccessToken(p: { refreshToken: string; clientId: string | null; clientSecret: string | null }): TokenResponse {
  const db = getDb()
  const hash = sha256(p.refreshToken)
  const row = db
    .select()
    .from(oauthTokens)
    .where(and(isNull(oauthTokens.revokedAt), or(eq(oauthTokens.refreshHash, hash), eq(oauthTokens.prevRefreshHash, hash))))
    .get()
  if (!row) throw new OAuthError('invalid_grant', 'Refresh-Token ungültig.')
  const clientId = p.clientId ?? row.clientId
  if (clientId !== row.clientId) throw new OAuthError('invalid_grant', 'Refresh-Token gehört zu einem anderen Client.')
  authenticateClient(clientId, p.clientSecret)
  const now = Date.now()
  if (row.refreshExpiresAt < now) throw new OAuthError('invalid_grant', 'Refresh-Token abgelaufen.')
  if (row.prevRefreshHash === hash && (!row.rotatedAt || now - row.rotatedAt > REFRESH_GRACE)) {
    throw new OAuthError('invalid_grant', 'Refresh-Token wurde bereits erneuert.')
  }
  const access = newSecret('lr_at_', 32)
  const refresh = newSecret('lr_rt_', 32)
  db.update(oauthTokens)
    .set({
      accessHash: sha256(access),
      prevRefreshHash: row.refreshHash,
      refreshHash: sha256(refresh),
      rotatedAt: now,
      accessExpiresAt: now + ACCESS_TTL,
      refreshExpiresAt: now + REFRESH_TTL,
      lastUsedAt: now,
    })
    .where(eq(oauthTokens.id, row.id))
    .run()
  db.update(oauthClients).set({ lastUsedAt: now }).where(eq(oauthClients.id, row.clientId)).run()
  return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL / 1000, refresh_token: refresh, scope: row.scope }
}

/** Returns the client id for a valid access token. */
export function verifyAccessToken(token: string): { clientId: string; scope: string } | null {
  if (!token.startsWith('lr_at_')) return null
  const db = getDb()
  const row = db
    .select()
    .from(oauthTokens)
    .where(and(eq(oauthTokens.accessHash, sha256(token)), isNull(oauthTokens.revokedAt)))
    .get()
  if (!row || row.accessExpiresAt < Date.now()) return null
  const now = Date.now()
  if (!row.lastUsedAt || now - row.lastUsedAt > 60_000) {
    db.update(oauthTokens).set({ lastUsedAt: now }).where(eq(oauthTokens.id, row.id)).run()
    db.update(oauthClients).set({ lastUsedAt: now }).where(eq(oauthClients.id, row.clientId)).run()
  }
  return { clientId: row.clientId, scope: row.scope }
}

export function revokeToken(token: string): void {
  const hash = sha256(token)
  getDb()
    .update(oauthTokens)
    .set({ revokedAt: Date.now() })
    .where(or(eq(oauthTokens.accessHash, hash), eq(oauthTokens.refreshHash, hash)))
    .run()
}

/** "Trennen" in the settings: removes the client and all its tokens. */
export function disconnectClient(clientId: string): void {
  getDb().delete(oauthClients).where(eq(oauthClients.id, clientId)).run()
}

export type ConnectedClient = { id: string; name: string; createdAt: number; lastUsedAt: number | null }

/** Clients that currently hold a usable token. */
export function listConnectedClients(): ConnectedClient[] {
  const db = getDb()
  const now = Date.now()
  const tokens = db
    .select({ clientId: oauthTokens.clientId, refreshExpiresAt: oauthTokens.refreshExpiresAt })
    .from(oauthTokens)
    .where(isNull(oauthTokens.revokedAt))
    .all()
    .filter((t) => t.refreshExpiresAt > now)
  const active = new Set(tokens.map((t) => t.clientId))
  return db
    .select()
    .from(oauthClients)
    .all()
    .filter((c) => active.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, createdAt: c.createdAt, lastUsedAt: c.lastUsedAt }))
    .sort((a, b) => (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt))
}

export function cleanupOAuth(): void {
  const db = getDb()
  const now = Date.now()
  db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, now - 24 * 60 * 60 * 1000)).run()
  db.delete(oauthTokens).where(lt(oauthTokens.refreshExpiresAt, now)).run()
  db.delete(oauthTokens).where(lt(oauthTokens.revokedAt, now - 7 * 24 * 60 * 60 * 1000)).run()
  // Registrations that never completed a login.
  const stale = db.select({ id: oauthClients.id, createdAt: oauthClients.createdAt }).from(oauthClients).all()
  const withTokens = new Set(db.select({ c: oauthTokens.clientId }).from(oauthTokens).all().map((r) => r.c))
  for (const c of stale) {
    if (!withTokens.has(c.id) && c.createdAt < now - 7 * 24 * 60 * 60 * 1000) {
      db.delete(oauthClients).where(eq(oauthClients.id, c.id)).run()
    }
  }
}
