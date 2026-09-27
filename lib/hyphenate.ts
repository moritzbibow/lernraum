import { hyphenateSync } from 'hyphen/de'

const SHY = '­'
const MIN_SIDE = 5
/** Endings that usually mark the joint of a German compound word. */
const JOINT = /(ings|ungs|heits|keits|schafts|ions|täts|tions|lings|ens)$/i

/**
 * Inserts soft hyphens into long German words for large display titles
 * ("Trainings­prinzipien"). Break points leaving fewer than 5 letters on
 * either side are dropped so lines never end in short fragments. With
 * `jointsOnly`, words are only split at compound joints (for wide headings);
 * `minLength` leaves words with fewer letters whole, so a heading breaks at
 * spaces unless a single word is too long for the line.
 */
export function softHyphenate(text: string, opts: { jointsOnly?: boolean; minLength?: number } = {}): string {
  if (!text) return text
  let out: string
  try {
    out = hyphenateSync(text, { hyphenChar: SHY, minWordLength: 10 })
  } catch {
    return text
  }
  return out.replace(/[^\s]+/g, (word) => {
    if (!word.includes(SHY)) return word
    const parts = word.split(SHY)
    if (opts.minLength && parts.join('').replace(/[^\p{L}]/gu, '').length < opts.minLength) return parts.join('')
    const total = parts.join('').length
    // Candidate break positions (index into parts) with enough letters on both sides.
    const candidates: number[] = []
    let left = parts[0].length
    for (let i = 1; i < parts.length; i++) {
      if (left >= MIN_SIDE && total - left >= MIN_SIDE) candidates.push(i)
      left += parts[i].length
    }
    // Prefer compound joints ("Trainings|prinzipien", "Leistungs|fähigkeit").
    const joint = candidates.filter((i) => JOINT.test(parts.slice(0, i).join('')))
    // Wide headings only break at compound joints; narrow tiles may use syllables.
    const keep = new Set(joint.length || opts.jointsOnly ? joint : candidates)
    return parts.map((p, i) => (i > 0 && keep.has(i) ? SHY + p : p)).join('')
  })
}
