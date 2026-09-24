import { absolute, json, readJson, withApi } from '@/lib/api'
import { NotFoundError } from '@/lib/services/errors'
import { replaceQuiz } from '@/lib/services/ingest'
import { getQuizDetail } from '@/lib/services/quizzes'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/quizzes/:id */
export const GET = withApi<Ctx>(
  async (_req, ctx) => {
    const { id } = await ctx.params
    const quiz = getQuizDetail(id)
    if (!quiz) throw new NotFoundError('Quiz nicht gefunden.')
    return json(quiz)
  },
  { allowSession: true },
)

/** PATCH /api/quizzes/:id – Titel/Fragen ersetzen (Format wie beim Ingest). */
export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params
  const result = replaceQuiz(id, await readJson(req))
  return json({ ...result, quizUrl: absolute(req, result.quizUrl) })
})
