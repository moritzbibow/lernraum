import { json, withApi } from '@/lib/api'
import { inboxSignature } from '@/lib/services/inbox'

export const dynamic = 'force-dynamic'

/** GET /api/inbox – Zähler für das Eingang-Badge (Live-Aktualisierung). */
export const GET = withApi(async () => json(inboxSignature()), { allowSession: true })
