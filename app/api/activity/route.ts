import { z } from 'zod'
import { json, readJson, withApi } from '@/lib/api'
import { parseOrThrow } from '@/lib/validation/content'
import { recordPageOpen, recordQuizOpen, updateTopicProgress } from '@/lib/services/progress'

export const dynamic = 'force-dynamic'

const activity = z.discriminatedUnion('type', [
  z.object({ type: z.literal('page-open'), pageId: z.string().min(1) }),
  z.object({ type: z.literal('quiz-open'), quizId: z.string().min(1) }),
  z.object({ type: z.literal('progress'), pageId: z.string().min(1), topics: z.record(z.string(), z.number()) }),
])

/** POST /api/activity – Lesefortschritt und "geöffnet" aus der Oberfläche (sendBeacon). */
export const POST = withApi(
  async (req) => {
    const input = parseOrThrow(activity, await readJson(req))
    if (input.type === 'page-open') return json(recordPageOpen(input.pageId))
    if (input.type === 'quiz-open') return json(recordQuizOpen(input.quizId))
    return json({ readProgress: updateTopicProgress(input.pageId, input.topics) })
  },
  { allowSession: true },
)
