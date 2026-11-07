import { fisherYates } from '../shuffle'
import type { NormalizedQuestion } from '../validation/content'

/** Below this many multiple-choice questions the percentages say nothing. */
const MIN_MC = 4
const SAME_POSITION_LIMIT = 0.4
const LONGEST_LIMIT = 0.5
/** Explanations that point at a position ("die zweite Antwort", "Antwort B") are wrong once answers are shuffled. */
const POSITION_IN_TEXT =
  /\b(erste|zweite|dritte|vierte|fünfte|letzte)[nrs]?\s+(antwort|option|möglichkeit)\b|\b(antwort|option)\s+[A-H]\b|\b[A-H]\)\s/i

const pct = (n: number, total: number) => Math.round((n / total) * 100)

/**
 * Patterns in a quiz as Claude sent it (before shuffling) that make answers guessable.
 * German messages, returned to Claude as ingest warnings.
 */
export function quizQualityWarnings(questions: NormalizedQuestion[]): string[] {
  const warnings: string[] = []
  const mc = questions.filter((q) => q.type === 'mc' && q.answers.length >= 2)

  if (mc.length >= MIN_MC) {
    const positions = new Map<number, number>()
    let longest = 0
    for (const q of mc) {
      const index = q.answers.findIndex((a) => a.correct)
      positions.set(index, (positions.get(index) ?? 0) + 1)
      const lengths = q.answers.map((a) => a.text.trim().length)
      const correctLength = lengths[index]
      if (lengths.every((l, i) => i === index || l < correctLength)) longest++
    }
    const [position, count] = [...positions.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]
    if (count / mc.length > SAME_POSITION_LIMIT) {
      warnings.push(
        `Die richtige Antwort stand in ${count} von ${mc.length} Multiple-Choice-Fragen an Position ${position + 1} (${pct(count, mc.length)} %). ` +
          'Die Antworten wurden gemischt; künftig die richtige Antwort gleichmäßig auf alle Positionen verteilen.',
      )
    }
    if (longest / mc.length > LONGEST_LIMIT) {
      warnings.push(
        `Die richtige Antwort ist in ${longest} von ${mc.length} Multiple-Choice-Fragen die längste (${pct(longest, mc.length)} %). ` +
          'Falsche Antworten ähnlich lang und genauso plausibel formulieren.',
      )
    }
  }

  const pointing = questions.flatMap((q, i) => (q.explanation && POSITION_IN_TEXT.test(q.explanation) ? [i + 1] : []))
  if (pointing.length) {
    warnings.push(
      `Erklärung bei Frage ${pointing.join(', ')} nennt eine Position („die zweite Antwort“, „Antwort B“). ` +
        'Die Antworten werden gemischt – in Erklärungen den Inhalt nennen, nie die Position.',
    )
  }
  return warnings
}

/** Shuffles the answers of multiple-choice questions; Wahr/Falsch keeps its fixed order. */
export function shuffleAnswers(questions: NormalizedQuestion[], rand: () => number = Math.random): NormalizedQuestion[] {
  return questions.map((q) => (q.type === 'mc' ? { ...q, answers: fisherYates(q.answers, rand) } : q))
}
