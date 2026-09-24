import { randomBytes } from 'node:crypto'
import { passwordFingerprint, sessionSecret } from '../env'
import { hmac, safeEqual } from './crypto'

/*
 * Stateless session: `v1.<expires>.<nonce>.<signature>`. The signature covers a
 * fingerprint of the password, so changing APP_PASSWORD logs out every device.
 * No imports from next/* here – this file is also used by proxy.ts.
 */

export const SESSION_COOKIE = 'lr_session'
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function createSessionToken(now = Date.now()): { value: string; expires: Date } {
  const expires = now + SESSION_TTL_MS
  const nonce = randomBytes(12).toString('base64url')
  const payload = `v1.${expires}.${nonce}`
  const sig = hmac(sessionSecret(), `${payload}.${passwordFingerprint()}`)
  return { value: `${payload}.${sig}`, expires: new Date(expires) }
}

export function verifySessionToken(token: string | undefined | null, now = Date.now()): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') return false
  const expires = Number(parts[1])
  if (!Number.isFinite(expires) || expires < now) return false
  const payload = parts.slice(0, 3).join('.')
  let expected: string
  try {
    expected = hmac(sessionSecret(), `${payload}.${passwordFingerprint()}`)
  } catch {
    return false
  }
  return safeEqual(parts[3], expected)
}
