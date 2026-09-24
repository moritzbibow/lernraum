import { json, withApi } from '@/lib/api'
import { outlineJson, outlineText } from '@/lib/services/outline'
import { buildTree } from '@/lib/services/tree'

export const dynamic = 'force-dynamic'

/** GET /api/tree – Struktur des Lernraums (JSON, oder ?format=text als Gliederung). */
export const GET = withApi(
  async (req) => {
    const tree = buildTree()
    if (new URL(req.url).searchParams.get('format') === 'text') {
      return new Response(outlineText(tree), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
    }
    return json(outlineJson(tree))
  },
  { allowSession: true },
)
