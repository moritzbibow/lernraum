import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { attempts, pages, questions, quizzes, type Topic } from '../db/schema'
import { formatLessonDate } from '../format'
import { readingMinutes, splitTitle } from '../text'
import { listInbox, type InboxEntry, unseenCount } from './inbox'
import {
  childrenOf,
  loadLibrary,
  pageTrail,
  pageUrl,
  resolvePagePath,
  type Library,
  type PageLite,
  type SubjectRow,
} from './library'
import { quizzesForPage } from './quizzes'
import { quizPlayUrl, subjectUrl } from './urls'

export type SubjectInfo = { id: string; name: string; slug: string; hue: number; lightness: number; chroma: number; url: string }

function subjectInfo(s: SubjectRow | null | undefined): SubjectInfo | null {
  if (!s) return null
  return { id: s.id, name: s.name, slug: s.slug, hue: s.hue, lightness: s.lightness, chroma: s.chroma, url: subjectUrl(s.slug) }
}

const LESSON_PREFIX = /^((?:Stunde|Lektion|Kapitel|Einheit|Woche|Teil|Tag|Sitzung|Block|Modul|Thema|Vorlesung|Übung)\s+\d+[a-z]?)\b/i

/** "STUNDE 4 · 12. SEPTEMBER" – explicit kicker, or derived from title/date/parent. */
export function computeKicker(
  page: { title: string; kicker: string | null; lessonDate: string | null; createdAt: number },
  parentOrSubject: string | null,
): string {
  if (page.kicker) return page.kicker
  const parts: string[] = []
  const lesson = page.title.match(LESSON_PREFIX)
  if (lesson) parts.push(lesson[1])
  else {
    const { short, main } = splitTitle(page.title)
    if (short !== main) parts.push(short)
  }
  if (page.lessonDate) parts.push(formatLessonDate(page.lessonDate))
  else if (lesson) parts.push(formatLessonDate(new Date(page.createdAt).toISOString().slice(0, 10)))
  if (parts.length === 0 && parentOrSubject) parts.push(parentOrSubject)
  return parts.join(' · ')
}

export type ChildCard = {
  id: string
  title: string
  url: string
  isFolder: boolean
  topicCount: number
  childCount: number
  readProgress: number
  quizQuestions: number
  updatedAt: number
}

function childCards(lib: Library, list: PageLite[]): ChildCard[] {
  if (!list.length) return []
  const ids = list.map((p) => p.id)
  const db = getDb()
  const topicRows = db
    .select({ id: pages.id, n: sql<number>`json_array_length(${pages.topics})` })
    .from(pages)
    .where(inArray(pages.id, ids))
    .all()
  const topicCount = new Map(topicRows.map((r) => [r.id, r.n]))
  const quizRows = db
    .select({
      pageId: quizzes.pageId,
      n: sql<number>`coalesce(sum((SELECT count(*) FROM questions qq WHERE qq.quiz_id = quizzes.id)), 0)`,
    })
    .from(quizzes)
    .where(and(inArray(quizzes.pageId, ids), isNull(quizzes.deletedAt)))
    .groupBy(quizzes.pageId)
    .all()
  const quizQuestions = new Map(quizRows.map((r) => [r.pageId, r.n]))
  return list.map((p) => ({
    id: p.id,
    title: p.title,
    url: pageUrl(lib, p.id) ?? '/',
    isFolder: !p.hasContent,
    topicCount: topicCount.get(p.id) ?? 0,
    childCount: childrenOf(lib, p.subjectId, p.id).length,
    readProgress: p.readProgress,
    quizQuestions: quizQuestions.get(p.id) ?? 0,
    updatedAt: p.updatedAt,
  }))
}

export type Crumb = { id: string; label: string; title: string; url: string }

export type PageView = {
  id: string
  title: string
  heading: string
  kicker: string
  url: string
  contentMd: string
  topics: Topic[]
  topicProgress: Record<string, number>
  readProgress: number
  wordCount: number
  readingMinutes: number
  source: 'claude' | 'manual'
  createdAt: number
  updatedAt: number
  isFolder: boolean
  subject: SubjectInfo | null
  crumbs: Crumb[]
  children: ChildCard[]
  quizzes: ReturnType<typeof quizzesForPage>
}

export function getPageView(subjectSlug: string | null, slugs: string[], lib: Library = loadLibrary()): PageView | null {
  const lite = resolvePagePath(lib, subjectSlug, slugs)
  if (!lite) return null
  return getPageViewById(lite.id, lib)
}

export function getPageViewById(pageId: string, lib: Library = loadLibrary()): PageView | null {
  const lite = lib.pageById.get(pageId)
  if (!lite) return null
  const row = getDb().select().from(pages).where(eq(pages.id, pageId)).get()
  if (!row) return null
  const subject = lite.subjectId ? lib.subjectById.get(lite.subjectId) : null
  const trail = pageTrail(lib, pageId)
  const parent = trail.length > 1 ? trail[trail.length - 2] : null
  const crumbs: Crumb[] = [
    subject
      ? { id: subject.id, label: subject.name, title: subject.name, url: subjectUrl(subject.slug) }
      : { id: 'general', label: 'Allgemein', title: 'Allgemeine Seiten', url: '/allgemein' },
    ...trail.map((p) => ({ id: p.id, label: splitTitle(p.title).short, title: p.title, url: pageUrl(lib, p.id) ?? '/' })),
  ]
  const parentLabel = parent ? parent.title : subject ? subject.name : null
  return {
    id: row.id,
    title: row.title,
    heading: row.heading || splitTitle(row.title).main,
    kicker: computeKicker(row, parentLabel && subject && parent ? `${subject.name} · ${parent.title}` : parentLabel),
    url: pageUrl(lib, pageId) ?? '/',
    contentMd: row.contentMd,
    topics: row.topics,
    topicProgress: row.topicProgress,
    readProgress: row.readProgress,
    wordCount: row.wordCount,
    readingMinutes: readingMinutes(row.wordCount),
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isFolder: !row.contentMd.trim(),
    subject: subjectInfo(subject),
    crumbs,
    children: childCards(lib, childrenOf(lib, lite.subjectId, lite.id)),
    quizzes: quizzesForPage(pageId),
  }
}

export type ContainerView = {
  subject: SubjectInfo | null
  sections: { page: ChildCard; children: ChildCard[] }[]
  loose: ChildCard[]
  pageCount: number
  quizCount: number
}

/** Subject overview (/f/sport) or general pages (/allgemein). */
export function getContainerView(subjectSlug: string | null, lib: Library = loadLibrary()): ContainerView | null {
  let subject: SubjectRow | null = null
  if (subjectSlug !== null) {
    subject = lib.subjects.find((s) => s.slug === subjectSlug) ?? null
    if (!subject) return null
  }
  const top = childrenOf(lib, subject?.id ?? null, null)
  const cards = childCards(lib, top)
  const sections: ContainerView['sections'] = []
  const loose: ChildCard[] = []
  top.forEach((p, i) => {
    const kids = childrenOf(lib, p.subjectId, p.id)
    if (kids.length) sections.push({ page: cards[i], children: childCards(lib, kids) })
    else loose.push(cards[i])
  })
  const inContainer = lib.pages.filter((p) => p.subjectId === (subject?.id ?? null))
  const quizCount =
    inContainer.length === 0
      ? 0
      : (getDb()
          .select({ n: sql<number>`count(*)` })
          .from(quizzes)
          .where(and(inArray(quizzes.pageId, inContainer.map((p) => p.id)), isNull(quizzes.deletedAt)))
          .get()?.n ?? 0)
  return {
    subject: subjectInfo(subject),
    sections,
    loose,
    pageCount: inContainer.filter((p) => p.hasContent).length,
    quizCount,
  }
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export type ContinueCard = {
  pageId: string
  title: string
  mainTitle: string
  subject: SubjectInfo | null
  pathLabel: string
  url: string
  progress: number
  topics: { title: string; done: boolean }[]
  quiz: { id: string; url: string; questionCount: number } | null
}

export type RecentCard = { pageId: string; title: string; label: string; url: string; progress: number; subject: SubjectInfo | null }
export type Chip = { title: string; url: string }

export type Dashboard = {
  continueCard: ContinueCard | null
  fresh: InboxEntry[]
  recent: RecentCard[]
  chips: Chip[]
  unseen: number
  isEmpty: boolean
}

function topicWindow(topics: Topic[], progress: Record<string, number>): { title: string; done: boolean }[] {
  const marks = topics.map((t) => ({ title: t.title, done: (progress[t.id] ?? 0) >= 0.8 }))
  if (marks.length <= 3) return marks
  const firstOpen = marks.findIndex((m) => !m.done)
  const anchor = firstOpen === -1 ? marks.length - 1 : firstOpen
  const start = Math.max(0, Math.min(anchor - 2, marks.length - 3))
  return marks.slice(start, start + 3)
}

export function getDashboard(): Dashboard {
  const lib = loadLibrary()
  const db = getDb()
  const contentPages = lib.pages.filter((p) => p.hasContent && (!p.subjectId || lib.subjectById.has(p.subjectId)))
  const opened = contentPages.filter((p) => p.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
  const newest = [...contentPages].sort((a, b) => (b.contentUpdatedAt ?? b.createdAt) - (a.contentUpdatedAt ?? a.createdAt))

  const continuePage = opened.find((p) => p.readProgress < 0.999) ?? opened[0] ?? newest[0] ?? null

  let continueCard: ContinueCard | null = null
  if (continuePage) {
    const full = db.select({ topics: pages.topics, topicProgress: pages.topicProgress }).from(pages).where(eq(pages.id, continuePage.id)).get()
    const subject = continuePage.subjectId ? lib.subjectById.get(continuePage.subjectId) : null
    const trail = pageTrail(lib, continuePage.id)
    const quiz = quizzesForPage(continuePage.id)[0]
    continueCard = {
      pageId: continuePage.id,
      title: continuePage.title,
      mainTitle: continuePage.heading && continuePage.heading.length <= 28 ? continuePage.heading : splitTitle(continuePage.title).main,
      subject: subjectInfo(subject),
      pathLabel: [...trail.slice(0, -1).map((p) => p.title), splitTitle(continuePage.title).short].join(' › '),
      url: pageUrl(lib, continuePage.id) ?? '/',
      progress: continuePage.readProgress,
      topics: topicWindow(full?.topics ?? [], full?.topicProgress ?? {}),
      quiz: quiz ? { id: quiz.id, url: quizPlayUrl(quiz.id), questionCount: quiz.questionCount } : null,
    }
  }

  const used = new Set(continuePage ? [continuePage.id] : [])
  const recentPages = [...opened, ...newest].filter((p) => {
    if (used.has(p.id)) return false
    used.add(p.id)
    return true
  })
  const recent: RecentCard[] = recentPages.slice(0, 2).map((p) => {
    const subject = p.subjectId ? lib.subjectById.get(p.subjectId) : null
    const trail = pageTrail(lib, p.id)
    const parent = trail.length > 1 ? trail[trail.length - 2] : null
    return {
      pageId: p.id,
      title: p.heading && p.heading.length <= 40 ? p.heading : splitTitle(p.title).main,
      label: [subject?.name ?? 'Allgemein', parent?.title].filter(Boolean).join(' › '),
      url: pageUrl(lib, p.id) ?? '/',
      progress: p.readProgress,
      subject: subjectInfo(subject),
    }
  })

  // Chips: most recent activity – opened pages and played quizzes.
  const played = db
    .select({ quizId: attempts.quizId, at: sql<number>`max(${attempts.finishedAt})` })
    .from(attempts)
    .groupBy(attempts.quizId)
    .orderBy(desc(sql`max(${attempts.finishedAt})`))
    .limit(3)
    .all()
  const playedQuizzes = played.length
    ? db
        .select({ id: quizzes.id, title: quizzes.title, pageId: quizzes.pageId })
        .from(quizzes)
        .where(and(inArray(quizzes.id, played.map((p) => p.quizId)), isNull(quizzes.deletedAt)))
        .all()
    : []
  const activity = [
    ...opened.slice(0, 3).map((p) => ({ at: p.lastOpenedAt ?? 0, chip: { title: p.title, url: pageUrl(lib, p.id) ?? '/' } })),
    ...played
      .map((p) => {
        const q = playedQuizzes.find((x) => x.id === p.quizId)
        if (!q || !lib.pageById.has(q.pageId)) return null
        return { at: p.at, chip: { title: /quiz/i.test(q.title) ? q.title : `${q.title} Quiz`, url: quizPlayUrl(q.id) } }
      })
      .filter((x): x is { at: number; chip: Chip } => x !== null),
  ]
  const chips = activity.sort((a, b) => b.at - a.at).slice(0, 3).map((a) => a.chip)

  return {
    continueCard,
    fresh: listInbox({ limit: 3, lib }),
    recent,
    chips,
    unseen: unseenCount(),
    isEmpty: lib.pages.length === 0 && lib.subjects.length === 0,
  }
}

