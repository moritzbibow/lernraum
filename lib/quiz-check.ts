/** Tolerant comparison for free-text answers (case, accents, punctuation, 1 typo). */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function distance(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1))
      last = tmp
    }
  }
  return prev[b.length]
}

export function checkFreeText(input: string, accepted: string[]): boolean {
  const given = normalize(input)
  if (!given) return false
  return accepted.some((answer) => {
    const expected = normalize(answer)
    if (!expected) return false
    if (given === expected) return true
    // Allow one typo per 7 characters for longer words.
    const tolerance = Math.floor(expected.length / 7)
    return tolerance > 0 && distance(given, expected) <= tolerance
  })
}
