import { baseUrl } from '@/lib/env'
import { loadLibrary, pageUrl } from '@/lib/services/library'

export const dynamic = 'force-dynamic'

/** Stable short link /p/<pageId> → current path (pages can be moved/renamed). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const url = pageUrl(loadLibrary(), id) ?? '/'
  return Response.redirect(new URL(url, baseUrl(req.headers)), 307)
}
