type Bucket = { count: number; resetAt: number }

const g = globalThis as unknown as { __lernraumRate?: Map<string, Bucket> }
const buckets = (g.__lernraumRate ??= new Map())

/** Fixed-window in-memory limiter (single process – good enough for one VPS). */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfter: number } {
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k)
  }
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }
  bucket.count++
  if (bucket.count > limit) return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  return { ok: true, retryAfter: 0 }
}

export function resetRateLimit(key: string) {
  buckets.delete(key)
}

export function clientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip')?.trim() ||
    'local'
  )
}
