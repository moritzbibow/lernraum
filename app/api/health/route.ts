import { getSqlite } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

export function GET() {
  try {
    getSqlite().prepare('SELECT 1').get()
    return Response.json({ ok: true, service: 'lernraum' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 503 })
  }
}
