/** Route helpers – the single place where app URLs are built. */

export function subjectUrl(subjectSlug: string): string {
  return `/f/${subjectSlug}`
}

export function pageUrlFromSlugs(subjectSlug: string | null, slugs: string[]): string {
  const tail = slugs.map(encodeURIComponent).join('/')
  if (subjectSlug === null) return tail ? `/allgemein/${tail}` : '/allgemein'
  return tail ? `/f/${subjectSlug}/${tail}` : `/f/${subjectSlug}`
}

export function shortPageUrl(pageId: string): string {
  return `/p/${pageId}`
}

export function quizPlayUrl(quizId: string): string {
  return `/quiz/${quizId}`
}

export function quizEditUrl(quizId: string): string {
  return `/quiz/${quizId}/bearbeiten`
}

export const GENERAL_URL = '/allgemein'
