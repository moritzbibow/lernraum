import { json, withApi } from '@/lib/api'
import { getPageForApi } from '@/lib/services/api-views'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/pages/:id – Seite inkl. Markdown und Quizzen. */
export const GET = withApi<Ctx>(
  async (_req, ctx) => {
    const { id } = await ctx.params
    return json(getPageForApi(decodeURIComponent(id)))
  },
  { allowSession: true },
)
