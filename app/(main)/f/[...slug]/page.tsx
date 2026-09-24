import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ContainerView } from '@/components/page/ContainerView'
import { PageView } from '@/components/page/PageView'
import { loadLibrary, resolvePagePath } from '@/lib/services/library'
import { getContainerView, getPageView } from '@/lib/services/views'

type Props = { params: Promise<{ slug: string[] }> }

function decode(parts: string[]) {
  return parts.map((p) => decodeURIComponent(p))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [subjectSlug, ...rest] = decode((await params).slug)
  const lib = loadLibrary()
  if (rest.length === 0) return { title: lib.subjects.find((s) => s.slug === subjectSlug)?.name ?? 'Fach' }
  return { title: resolvePagePath(lib, subjectSlug, rest)?.title ?? 'Lernseite' }
}

export default async function SubjectOrPage({ params }: Props) {
  const [subjectSlug, ...rest] = decode((await params).slug)
  const lib = loadLibrary()
  if (rest.length === 0) {
    const data = getContainerView(subjectSlug, lib)
    if (!data) notFound()
    return <ContainerView data={data} />
  }
  const page = getPageView(subjectSlug, rest, lib)
  if (!page) notFound()
  return <PageView page={page} />
}
