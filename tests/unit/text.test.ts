import { describe, expect, it } from 'vitest'
import { slugify, uniqueSlug } from '@/lib/slug'
import { initials, naturalCompare, splitTitle } from '@/lib/text'
import { pickSubjectColor } from '@/lib/colors'
import { formatChanged } from '@/lib/format'

describe('text helpers', () => {
  it('slugifies German titles', () => {
    expect(slugify('Stunde 5 – Ausdauertraining')).toBe('stunde-5-ausdauertraining')
    expect(slugify('Übung & Größe')).toBe('uebung-und-groesse')
    expect(slugify('   ')).toBe('seite')
    expect(uniqueSlug('a', ['a', 'a-2'])).toBe('a-3')
  })

  it('splits titles into short label and display name', () => {
    expect(splitTitle('Stunde 4 – Trainingsprinzipien')).toEqual({ short: 'Stunde 4', main: 'Trainingsprinzipien' })
    expect(splitTitle('Past Perfect vs. Simple Past')).toEqual({
      short: 'Past Perfect vs. Simple Past',
      main: 'Past Perfect vs. Simple Past',
    })
  })

  it('sorts naturally and builds initials', () => {
    expect(['Stunde 10', 'Stunde 2'].sort(naturalCompare)).toEqual(['Stunde 2', 'Stunde 10'])
    expect(initials('Moritz Bibow')).toBe('MB')
  })

  it('assigns design colors to known subjects and spreads new hues', () => {
    expect(pickSubjectColor('Englisch', [])).toMatchObject({ hue: 235, lightness: 0.8 })
    const hue = pickSubjectColor('Chemie', [140, 235]).hue
    expect(Math.min(Math.abs(hue - 140), Math.abs(hue - 235))).toBeGreaterThan(60)
  })

  it('formats change dates like the Verwalten table', () => {
    const now = new Date(2026, 8, 24, 20, 0).getTime()
    expect(formatChanged(now - 12 * 60_000, now)).toBe('vor 12 Min.')
    expect(formatChanged(new Date(2026, 8, 24, 9).getTime(), now)).toBe('heute')
    expect(formatChanged(new Date(2026, 8, 23, 9).getTime(), now)).toBe('gestern')
    expect(formatChanged(new Date(2026, 8, 21, 9).getTime(), now)).toBe('Mo.')
    expect(formatChanged(new Date(2026, 7, 29, 9).getTime(), now)).toBe('29.08.')
  })
})
