import { normalizeForMatch } from './text'

export type SubjectColor = { hue: number; lightness: number; chroma: number }

/** Colors from the design handoff for the subjects shown in the mockups. */
const KNOWN: Record<string, SubjectColor> = {
  sport: { hue: 140, lightness: 0.84, chroma: 0.11 },
  englisch: { hue: 235, lightness: 0.8, chroma: 0.1 },
  mathe: { hue: 290, lightness: 0.8, chroma: 0.1 },
  mathematik: { hue: 290, lightness: 0.8, chroma: 0.1 },
  philosophie: { hue: 75, lightness: 0.82, chroma: 0.1 },
  geschichte: { hue: 30, lightness: 0.78, chroma: 0.11 },
}

const DEFAULT_L = 0.82
const DEFAULT_C = 0.1

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/** New subjects get the same L/C and the hue farthest away from existing ones. */
export function pickSubjectColor(name: string, usedHues: number[]): SubjectColor {
  const known = KNOWN[normalizeForMatch(name)]
  if (known && !usedHues.some((h) => hueDistance(h, known.hue) < 12)) return known
  if (usedHues.length === 0) return { hue: 140, lightness: DEFAULT_L, chroma: DEFAULT_C }
  let best = 0
  let bestDistance = -1
  for (let hue = 0; hue < 360; hue += 5) {
    const nearest = Math.min(...usedHues.map((h) => hueDistance(h, hue)))
    if (nearest > bestDistance) {
      best = hue
      bestDistance = nearest
    }
  }
  return { hue: best, lightness: DEFAULT_L, chroma: DEFAULT_C }
}
