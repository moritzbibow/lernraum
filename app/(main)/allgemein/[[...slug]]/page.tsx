import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ContainerView } from '@/components/page/ContainerView'
import { PageView } from '@/components/page/PageView'
import { loadLibrary, resolvePagePath } from '@/lib/services/library'
import { getContainerView, getPageView } from '@/lib/services/views'

type Props = { params: Promise<{ slug?: string[] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slugs = ((await params).slug ?? []).map(decodeURIComponent)
  if (slugs.length === 0) return { title: 'Allgemeine Seiten' }
  return { title: resolvePagePath(loadLibrary(), null, slugs)?.title ?? 'Lernseite' }
}

export default async function GeneralPages({ params }: Props) {
  const slugs = ((await params).slug ?? []).map(decodeURIComponent)
  const lib = loadLibrary()
  if (slugs.length === 0) return <ContainerView data={getContainerView(null, lib)!} />
  const page = getPageView(null, slugs, lib)
  if (!page) notFound()
  return <PageView page={page} />
}
