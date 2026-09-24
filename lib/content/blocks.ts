/**
 * Registry of custom content blocks (`:::name … :::` in Markdown).
 *
 * Adding a new block type = add an entry here, a style in app/prose.css
 * (`.callout--<tone>` or a dedicated class) and a line in the format guide.
 */

export type BlockTone = 'accent' | 'blue' | 'violet' | 'amber' | 'danger' | 'neutral'

export type BlockDefinition = {
  /** Default label, shown in the block header (can be overridden: `:::merke[Eigenes Label]`). */
  label: string
  tone: BlockTone
  /** Rendered as a collapsible <details> element. */
  collapsible?: boolean
  /** Rendered as a quote with optional `quelle` attribute. */
  quote?: boolean
  /** Short description for the format guide. */
  description: string
}

export const BLOCKS: Record<string, BlockDefinition> = {
  merke: { label: 'Merke', tone: 'accent', description: 'Kernaussage, die man sich einprägen soll' },
  definition: { label: 'Definition', tone: 'blue', description: 'Begriffsdefinition' },
  beispiel: { label: 'Beispiel', tone: 'violet', description: 'Konkretes Beispiel oder Anwendung' },
  tipp: { label: 'Tipp', tone: 'amber', description: 'Eselsbrücke, Lerntipp, Hinweis' },
  achtung: { label: 'Achtung', tone: 'danger', description: 'Typischer Fehler, Stolperstelle' },
  zitat: { label: 'Zitat', tone: 'neutral', quote: true, description: 'Zitat, optional mit {quelle="…"}' },
  details: {
    label: 'Details',
    tone: 'neutral',
    collapsible: true,
    description: 'Aufklappbarer Bereich, z. B. :::details[Lösung anzeigen]',
  },
}

const ALIASES: Record<string, string> = {
  wichtig: 'merke',
  kernaussage: 'merke',
  hinweis: 'tipp',
  eselsbruecke: 'tipp',
  warnung: 'achtung',
  vorsicht: 'achtung',
  fehler: 'achtung',
  beispiele: 'beispiel',
  def: 'definition',
  begriff: 'definition',
  quote: 'zitat',
  loesung: 'details',
  lösung: 'details',
  aufklappen: 'details',
  info: 'tipp',
  note: 'tipp',
  tip: 'tipp',
  warning: 'achtung',
  important: 'merke',
  example: 'beispiel',
}

export function resolveBlock(name: string): { key: string; def: BlockDefinition } | null {
  const lower = name.toLowerCase()
  const key = BLOCKS[lower] ? lower : ALIASES[lower]
  if (!key) return null
  return { key, def: BLOCKS[key] }
}
