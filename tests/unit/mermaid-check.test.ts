import { beforeEach, describe, expect, it } from 'vitest'
import { findDiagramErrors } from '@/lib/content/mermaid-check'
import { resetDbForTests } from '@/lib/db/client'
import { ValidationError } from '@/lib/services/errors'
import { ingestChecked } from '@/lib/services/ingest'
import { loadLibrary } from '@/lib/services/library'

const mindmap = 'mindmap\n  root((Bewegungsanalyse))\n    Beobachtung von außen\n      situativ während der Handlung\n    Erfassen von Ursachen'

describe('findDiagramErrors', () => {
  it('accepts valid diagrams of common types', async () => {
    const valid = [
      mindmap,
      'flowchart TD\n  A[Start] --> B{Ist es?}\n  B -->|Ja| C["Kraft (N)"]',
      'sequenceDiagram\n  Alice->>Bob: Hallo',
      'timeline\n  title Geschichte\n  1914 : Erster Weltkrieg',
      'pie title Anteile\n  "A" : 40\n  "B" : 60',
    ]
    expect(await findDiagramErrors(valid)).toEqual([])
  }, 30_000)

  it('reports a flattened mindmap with a hint about indentation', async () => {
    const [error, ...rest] = await findDiagramErrors(['mindmap\nroot((A))\nB\nC'])
    expect(rest).toEqual([])
    expect(error).toContain('Mermaid-Diagramm 1')
    expect(error).toContain('only one root')
    expect(error).toContain('Einrückung')
  }, 30_000)

  it('reports unquoted special characters in flowchart labels', async () => {
    const errors = await findDiagramErrors([mindmap, 'flowchart TD\n  A[Kraft (N)] --> B'])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('Mermaid-Diagramm 2')
    expect(errors[0]).toContain('Parse error on line 2')
    expect(errors[0]).toContain('A["Kraft (N)"]')
  }, 30_000)
})

describe('ingestChecked', () => {
  beforeEach(() => {
    resetDbForTests()
  })

  const page = (diagram: string) => ({
    subject: 'Sport',
    path: ['Sporttheorie'],
    page: { title: 'Bewegungsanalyse', content_md: `## Methoden\n\n\`\`\`mermaid\n${diagram}\n\`\`\`\n` },
  })

  it('rejects a page with a broken diagram and stores nothing', async () => {
    const error = await ingestChecked(page('mindmap\nroot((A))\nB')).catch((e) => e)
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).issues[0].path).toBe('page.content_md')
    const library = loadLibrary()
    expect(library.pages).toHaveLength(0)
    expect(library.subjects).toHaveLength(0)
  }, 30_000)

  it('ingests a page with valid diagrams', async () => {
    const result = await ingestChecked(page(mindmap))
    expect(result.created).toBe(true)
    expect(result.topics.map((t) => t.title)).toEqual(['Methoden'])
  }, 30_000)
})
