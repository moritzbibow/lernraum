import { authenticate, type Principal } from './auth/api-auth'
import { baseUrl } from './env'
import { AppError } from './services/errors'

/* Helpers for route handlers (JSON in/out, auth, errors). */

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function errorResponse(status: number, error: string, message: string, extra: Record<string, unknown> = {}): Response {
  return json({ ok: false, error, message, ...extra }, { status })
}

export function unauthorized(message = 'Nicht autorisiert. Header "Authorization: Bearer <Token>" fehlt oder ist ungültig.'): Response {
  return json(
    { ok: false, error: 'unauthorized', message },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="lernraum"' } },
  )
}

export function handleApiError(e: unknown): Response {
  if (e instanceof AppError) {
    return errorResponse(e.status, e.code, e.message, e.issues.length ? { issues: e.issues } : {})
  }
  console.error('[lernraum] API-Fehler:', e)
  return errorResponse(500, 'internal_error', 'Interner Fehler. Details stehen im Server-Log.')
}

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text()
  if (!text.trim()) throw new AppError('Leerer Request-Body – JSON erwartet.', 400, 'invalid_json')
  try {
    return JSON.parse(text)
  } catch (e) {
    throw new AppError(`Ungültiges JSON: ${(e as Error).message}`, 400, 'invalid_json')
  }
}

type Handler<C> = (req: Request, ctx: C, principal: Principal) => Promise<Response> | Response

/** Wraps a route handler with authentication and uniform error handling. */
export function withApi<C>(handler: Handler<C>, opts: { allowSession?: boolean } = {}) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      const principal = authenticate(req, opts)
      if (!principal) return unauthorized()
      return await handler(req, ctx, principal)
    } catch (e) {
      return handleApiError(e)
    }
  }
}

export function absolute(req: Request, path: string | null): string | null {
  if (!path) return null
  return `${baseUrl(req.headers)}${path}`
}
