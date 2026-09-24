import { describe, expect, it } from 'vitest'
import { softHyphenate } from '@/lib/hyphenate'
import { checkFreeText } from '@/lib/quiz-check'

const show = (s: string) => s.replace(/­/g, '|')

describe('softHyphenate', () => {
  it('prefers compound joints and avoids short fragments', () => {
    expect(show(softHyphenate('Trainingsprinzipien'))).toBe('Trainings|prinzipien')
    expect(show(softHyphenate('Leistungsfähigkeit'))).toBe('Leistungs|fähigkeit')
    expect(show(softHyphenate('Kurz und klar'))).toBe('Kurz und klar')
  })

  it('only splits at joints for wide headings', () => {
    expect(show(softHyphenate('Superkompensation', { jointsOnly: true }))).toBe('Superkompensation')
    expect(show(softHyphenate('Superkompensation'))).toContain('|')
  })
})

describe('checkFreeText', () => {
  it('ignores case, accents and punctuation', () => {
    expect(checkFreeText('  superkompensation. ', ['Superkompensation'])).toBe(true)
    expect(checkFreeText('Intensitaet', ['Intensität'])).toBe(true)
  })

  it('tolerates one typo in longer words, but not in short ones', () => {
    expect(checkFreeText('Superkompensaton', ['Superkompensation'])).toBe(true)
    expect(checkFreeText('Kraf', ['Kraft'])).toBe(false)
    expect(checkFreeText('went', ['went'])).toBe(true)
  })

  it('accepts any of several answers and rejects empty input', () => {
    expect(checkFreeText('Dichte', ['Umfang', 'Intensität', 'Dichte'])).toBe(true)
    expect(checkFreeText('   ', ['x'])).toBe(false)
  })
})
