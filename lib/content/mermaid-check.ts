/*
 * Syntax check for ```mermaid blocks on the server, with mermaid's own parser
 * (nothing is rendered). A broken diagram is rejected at ingest time, so Claude
 * gets the error message and can fix it before anything goes online.
 */

type Parse = (source: string) => Promise<unknown>

let parser: Promise<Parse | null> | null = null

async function loadParser(): Promise<Parse | null> {
  try {
    // Mermaid expects DOMPurify with a browser window. Parsing needs no sanitizing, and
    // without a DOM DOMPurify has no working methods anyway, so it gets no-ops here.
    const purify = (await import('dompurify')).default as unknown as Record<string, unknown>
    const noop = () => {}
    Object.assign(purify, {
      addHook: noop,
      removeHook: noop,
      removeHooks: noop,
      removeAllHooks: noop,
      sanitize: (value: unknown) => String(value),
    })
    const mermaid = (await import('mermaid')).default
    return (source) => mermaid.parse(source)
  } catch (e) {
    console.warn('[lernraum] Mermaid lässt sich auf dem Server nicht laden – Diagramme werden nicht geprüft:', e)
    return null
  }
}

/** Problems of the environment, not of the diagram – they never block an ingest. */
function isEnvironmentError(e: unknown) {
  return e instanceof TypeError || e instanceof ReferenceError
}

function hint(source: string): string {
  const type = source.trim().split(/\s/, 1)[0]?.toLowerCase() ?? ''
  if (type === 'mindmap') {
    return 'Bei mindmap bestimmt nur die Einrückung mit Leerzeichen die Ebenen, und es gibt genau einen Wurzelknoten.'
  }
  if (type.startsWith('flowchart') || type === 'graph') {
    return 'Beschriftungen mit Sonderzeichen wie ( ) [ ] { } : ; # in Anführungszeichen setzen, z. B. A["Kraft (N)"].'
  }
  return 'Die erste Zeile nennt den Diagrammtyp (z. B. flowchart TD, mindmap, sequenceDiagram, timeline); danach dessen Syntax prüfen.'
}

/** Mermaid's message without the ASCII pointer lines, shortened to what helps fixing it. */
function describe(e: unknown): string {
  const lines = (e instanceof Error ? e.message : String(e))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^-*\^$/.test(line))
  const expecting = lines.find((line) => line.startsWith('Expecting'))
  const parts = [lines[0], lines[1] && lines[1] !== expecting ? `bei „${lines[1]}“` : null, expecting]
  return parts
    .filter(Boolean)
    .join(' ')
    .slice(0, 400)
}

/** One German message per ```mermaid block that mermaid cannot parse (empty = all fine). */
export async function findDiagramErrors(sources: string[]): Promise<string[]> {
  if (sources.length === 0) return []
  parser ??= loadParser()
  const parse = await parser
  if (!parse) return []
  const errors: string[] = []
  for (const [i, source] of sources.entries()) {
    try {
      await parse(source)
    } catch (e) {
      if (isEnvironmentError(e)) {
        console.warn('[lernraum] Mermaid-Prüfung übersprungen:', e)
        continue
      }
      errors.push(`Mermaid-Diagramm ${i + 1} lässt sich nicht darstellen: ${describe(e)}. Tipp: ${hint(source)}`)
    }
  }
  return errors
}
