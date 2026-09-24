import { randomBytes } from 'node:crypto'

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Short, URL-safe random id (≈71 bits of entropy for length 12). */
export function newId(length = 12): string {
  const bytes = randomBytes(length * 2)
  let out = ''
  for (let i = 0; i < bytes.length && out.length < length; i++) {
    const b = bytes[i]
    // Reject values that would bias the modulo (256 % 62 = 8).
    if (b < 248) out += ALPHABET[b % 62]
  }
  return out.length === length ? out : newId(length)
}

/** Opaque secret token (base64url) with a readable prefix. */
export function newSecret(prefix: string, bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString('base64url')}`
}
