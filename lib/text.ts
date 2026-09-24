const SEPARATOR = /\s+[–—-]\s+/

/**
 * Titles follow the pattern "Stunde 4 – Trainingsprinzipien": the part before
 * the dash is the short label (breadcrumbs, quiz header), the part after it the
 * display name (tiles, headings). Titles without a dash use the full title.
 */
export function splitTitle(title: string): { short: string; main: string } {
  const match = title.match(SEPARATOR)
  if (!match || match.index === undefined) return { short: title, main: title }
  const short = title.slice(0, match.index).trim()
  const main = title.slice(match.index + match[0].length).trim()
  if (!short || !main) return { short: title, main: title }
  return { short, main }
}

/** Lowercase, without diacritics/umlaut variants – for tolerant matching. */
export function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' })

/** "Stunde 2" < "Stunde 10" */
export function naturalCompare(a: string, b: string): number {
  return collator.compare(a, b)
}

export function countWords(text: string): number {
  const m = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)
  return m ? m.length : 0
}

export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 200))
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
