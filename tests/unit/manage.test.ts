import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '@/lib/db/client'
import { ConflictError } from '@/lib/services/errors'
import { ingest } from '@/lib/services/ingest'
import { childrenOf, loadLibrary, pageUrl } from '@/lib/services/library'
import { createFolder, createSubject, deleteItems, movePages, purgeDeleted, renameItem, restoreBatch } from '@/lib/services/manage'
import { search } from '@/lib/services/search'

function seed() {
  const a = ingest({ subject: 'Sport', path: ['Sporttheorie'], page: { title: 'Stunde 1 – Motorik', content_md: '## A\n\nx' } })
  const b = ingest({ subject: 'Sport', path: ['Sporttheorie'], page: { title: 'Stunde 2 – Kraft', content_md: '## B\n\ny' } })
  const c = ingest({ subject: 'Englisch', path: ['Grammatik'], page: { title: 'Past Perfect', content_md: '## C\n\nz' } })
  return { a, b, c }
}

describe('library management', () => {
  beforeEach(() => {
    resetDbForTests()
  })

  it('creates subjects with free hues and folders', () => {
    const s = createSubject('Chemie')
    const id = createFolder({ subjectId: s.id, parentId: null, title: 'Organik' })
    const lib = loadLibrary()
    expect(lib.pageById.get(id)!.title).toBe('Organik')
    expect(pageUrl(lib, id)).toBe('/f/chemie/organik')
  })

  it('moves pages across subjects with their subtree', () => {
    const { a, c } = seed()
    const lib = loadLibrary()
    const folder = lib.pageById.get(lib.pageById.get(a.pageId)!.parentId!)!
    const englisch = lib.subjects.find((s) => s.name === 'Englisch')!
    movePages([folder.id], { subjectId: englisch.id, parentId: null })
    const after = loadLibrary()
    expect(pageUrl(after, a.pageId)).toBe('/f/englisch/sporttheorie/stunde-1-motorik')
    expect(after.pageById.get(a.pageId)!.subjectId).toBe(englisch.id)
    expect(childrenOf(after, englisch.id, null).map((p) => p.title)).toEqual(['Grammatik', 'Sporttheorie'])
    void c
  })

  it('prevents moving a page into its own subtree', () => {
    const { a } = seed()
    const lib = loadLibrary()
    const folderId = lib.pageById.get(a.pageId)!.parentId!
    expect(() => movePages([folderId], { subjectId: lib.pageById.get(folderId)!.subjectId, parentId: a.pageId })).toThrow(
      ConflictError,
    )
  })

  it('positions moved pages before/after siblings and resolves slug clashes', () => {
    const { a, b } = seed()
    const lib = loadLibrary()
    const folderId = lib.pageById.get(a.pageId)!.parentId!
    const sport = lib.pageById.get(a.pageId)!.subjectId
    movePages([b.pageId], { subjectId: sport, parentId: folderId, beforeId: a.pageId })
    expect(childrenOf(loadLibrary(), sport, folderId).map((p) => p.title)).toEqual(['Stunde 2 – Kraft', 'Stunde 1 – Motorik'])

    const other = createFolder({ subjectId: sport, parentId: null, title: 'Andere' })
    const dup = createFolder({ subjectId: sport, parentId: other, title: 'Stunde 1 – Motorik' })
    movePages([dup], { subjectId: sport, parentId: folderId })
    const slugs = childrenOf(loadLibrary(), sport, folderId).map((p) => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('soft-deletes subtrees and restores them in one batch', () => {
    const { a } = seed()
    const lib = loadLibrary()
    const sport = lib.subjects.find((s) => s.name === 'Sport')!
    const { batch, count } = deleteItems([{ kind: 'subject', id: sport.id }])
    expect(count).toBeGreaterThanOrEqual(4)
    expect(loadLibrary().subjects.map((s) => s.name)).toEqual(['Englisch'])
    expect(search('Motorik')).toHaveLength(0)
    restoreBatch(batch)
    const back = loadLibrary()
    expect(back.subjects.map((s) => s.name)).toEqual(['Sport', 'Englisch'])
    expect(back.pageById.has(a.pageId)).toBe(true)
  })

  it('renames with new slugs and purges old deletions', () => {
    const { c } = seed()
    renameItem({ kind: 'page', id: c.pageId }, 'Past Perfect vs. Simple Past')
    expect(pageUrl(loadLibrary(), c.pageId)).toBe('/f/englisch/grammatik/past-perfect-vs-simple-past')
    deleteItems([{ kind: 'page', id: c.pageId }])
    expect(purgeDeleted(0)).toBeGreaterThanOrEqual(1)
  })
})

describe('search', () => {
  beforeEach(() => {
    resetDbForTests()
  })

  it('finds substrings of compounds, ignores umlauts and returns snippets', () => {
    ingest({
      subject: 'Sport',
      page: { title: 'Trainingsprinzipien', content_md: '## Superkompensation\n\nDie Leistungsfähigkeit steigt über das Ausgangsniveau.' },
    })
    const hits = search('kompensation')
    expect(hits[0]?.title).toBe('Trainingsprinzipien')
    expect(search('leistungsfahigkeit')[0]?.snippet).toContain('<mark>')
    expect(search('Sp').some((r) => r.kind === 'subject')).toBe(true)
  })
})
