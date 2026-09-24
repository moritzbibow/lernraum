import { and, isNull, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { questions, quizzes } from '../db/schema'
import { unseenPageIds } from './inbox'
import { childrenOf, loadLibrary, pageUrl, type Library, type PageLite } from './library'
import { GENERAL_URL, subjectUrl } from './urls'

export type TreeNode = {
  kind: 'subject' | 'page' | 'general'
  id: string
  title: string
  url: string
  /** Subject color (subjects only) */
  color?: { hue: number; lightness: number; chroma: number }
  isFolder: boolean
  isNew: boolean
  quizCount: number
  questionCount: number
  subtreeQuizCount: number
  updatedAt: number
  depth: number
  children: TreeNode[]
}

export type LibraryTree = { subjects: TreeNode[]; general: TreeNode }

type QuizStats = Map<string, { quizzes: number; questions: number }>

function quizStats(): QuizStats {
  const rows = getDb()
    .select({
      pageId: quizzes.pageId,
      quizzes: sql<number>`count(*)`,
      questions: sql<number>`coalesce(sum((SELECT count(*) FROM questions qq WHERE qq.quiz_id = quizzes.id)), 0)`,
    })
    .from(quizzes)
    .where(and(isNull(quizzes.deletedAt)))
    .groupBy(quizzes.pageId)
    .all()
  return new Map(rows.map((r) => [r.pageId, { quizzes: r.quizzes, questions: r.questions }]))
}

export function buildTree(lib: Library = loadLibrary()): LibraryTree {
  const stats = quizStats()
  const fresh = unseenPageIds()

  const pageNode = (p: PageLite, depth: number): TreeNode => {
    const kids = childrenOf(lib, p.subjectId, p.id).map((c) => pageNode(c, depth + 1))
    const own = stats.get(p.id)
    return {
      kind: 'page',
      id: p.id,
      title: p.title,
      url: pageUrl(lib, p.id) ?? '/',
      isFolder: !p.hasContent,
      isNew: fresh.has(p.id),
      quizCount: own?.quizzes ?? 0,
      questionCount: own?.questions ?? 0,
      subtreeQuizCount: (own?.quizzes ?? 0) + kids.reduce((n, k) => n + k.subtreeQuizCount, 0),
      updatedAt: Math.max(p.updatedAt, ...kids.map((k) => k.updatedAt)),
      depth,
      children: kids,
    }
  }

  const subjects = lib.subjects.map((s): TreeNode => {
    const kids = childrenOf(lib, s.id, null).map((p) => pageNode(p, 1))
    return {
      kind: 'subject',
      id: s.id,
      title: s.name,
      url: subjectUrl(s.slug),
      color: { hue: s.hue, lightness: s.lightness, chroma: s.chroma },
      isFolder: true,
      isNew: kids.some(function anyNew(k): boolean {
        return k.isNew || k.children.some(anyNew)
      }),
      quizCount: 0,
      questionCount: 0,
      subtreeQuizCount: kids.reduce((n, k) => n + k.subtreeQuizCount, 0),
      updatedAt: Math.max(s.updatedAt, ...kids.map((k) => k.updatedAt)),
      depth: 0,
      children: kids,
    }
  })

  const generalKids = childrenOf(lib, null, null).map((p) => pageNode(p, 1))
  const general: TreeNode = {
    kind: 'general',
    id: 'general',
    title: 'Allgemeine Seiten',
    url: GENERAL_URL,
    isFolder: true,
    isNew: generalKids.some((k) => k.isNew),
    quizCount: 0,
    questionCount: 0,
    subtreeQuizCount: generalKids.reduce((n, k) => n + k.subtreeQuizCount, 0),
    updatedAt: Math.max(0, ...generalKids.map((k) => k.updatedAt)),
    depth: 0,
    children: generalKids,
  }
  return { subjects, general }
}
