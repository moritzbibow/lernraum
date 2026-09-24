import { json, withApi } from '@/lib/api'
import { search } from '@/lib/services/search'

export const dynamic = 'force-dynamic'

/** GET /api/search?q=… – Volltextsuche (für ⌘K und Claude). */
export const GET = withApi(
  async (req) => {
    const q = new URL(req.url).searchParams.get('q') ?? ''
    return json({ query: q, results: search(q, 24) })
  },
  { allowSession: true },
)
