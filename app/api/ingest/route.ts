import { absolute, json, readJson, withApi } from '@/lib/api'
import { ingest } from '@/lib/services/ingest'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ingest – Lernseite (+ Quiz) einspeisen. Siehe docs/CONTENT_FORMAT.md.
 * Auth: Authorization: Bearer <LERNRAUM_API_TOKEN oder OAuth-Token>
 */
export const POST = withApi(async (req) => {
  const body = await readJson(req)
  const result = ingest(body, { source: 'claude' })
  return json(
    {
      ...result,
      url: absolute(req, result.url),
      shortUrl: absolute(req, result.shortUrl),
      quizUrl: absolute(req, result.quizUrl),
      quizEditUrl: absolute(req, result.quizEditUrl),
    },
    { status: result.created ? 201 : 200 },
  )
})
