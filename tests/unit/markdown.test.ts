import { describe, expect, it } from 'vitest'
import { analyzeMarkdown, renderMarkdown } from '@/lib/content/markdown'

describe('markdown pipeline', () => {
  it('extracts topics from ## headings and numbers them', () => {
    const md = '## Superkompensation\n\nText\n\n## Progressive Belastung\n\nMehr'
    const { html, topics } = renderMarkdown(md)
    expect(topics).toEqual([
      { id: 'superkompensation', title: 'Superkompensation' },
      { id: 'progressive-belastung', title: 'Progressive Belastung' },
    ])
    expect(html).toContain('<h2 id="t-superkompensation"><span class="h2-num">1 · </span>Superkompensation</h2>')
    expect(html).toContain('<span class="h2-num">2 · </span>Progressive Belastung')
  })

  it('drops a leading H1 and demotes later H1s to topics', () => {
    const { html, topics } = renderMarkdown('# Seitentitel\n\nIntro\n\n# Abschnitt')
    expect(html).not.toContain('Seitentitel')
    expect(topics.map((t) => t.title)).toEqual(['Abschnitt'])
  })

  it('renders custom blocks with labels and aliases', () => {
    const { html } = renderMarkdown(':::merke\nWichtig!\n:::\n\n:::warnung[Vorsicht Falle]\nText\n:::')
    expect(html).toContain('<aside class="callout callout--accent"><div class="callout__label">Merke</div>')
    expect(html).toContain('callout--danger')
    expect(html).toContain('Vorsicht Falle')
  })

  it('renders collapsible details and quotes with source', () => {
    const { html } = renderMarkdown(':::details[Lösung anzeigen]\n42\n:::\n\n:::zitat{quelle="Kant"}\nSapere aude\n:::')
    expect(html).toContain('<details class="callout callout--neutral"><summary class="callout__label">Lösung anzeigen</summary>')
    expect(html).toContain('— Kant')
  })

  it('keeps colons in normal text (no accidental directives)', () => {
    const { html } = renderMarkdown('Verhältnis 1:2, Klasse:A und Zeit 10:30')
    expect(html).toContain('Verhältnis 1:2, Klasse:A und Zeit 10:30')
  })

  it('renders math with KaTeX and marks it', () => {
    const r = renderMarkdown('Formel $a^2 + b^2 = c^2$\n\n$$\n\\frac{1}{2}\n$$')
    expect(r.hasMath).toBe(true)
    expect(r.html).toContain('class="katex"')
    expect(r.html).toContain('katex-display')
  })

  it('turns mermaid code blocks into client-rendered blocks', () => {
    const r = renderMarkdown('```mermaid\ngraph TD; A-->B\n```')
    expect(r.hasMermaid).toBe(true)
    expect(r.html).toContain('<div class="mermaid-block">graph TD; A-->B</div>')
  })

  it('sanitizes raw html and dangerous links', () => {
    const { html } = renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)> [x](javascript:alert(1))')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('javascript:')
  })

  it('wraps tables and opens external links in a new tab', () => {
    const { html } = renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |\n\n[Link](https://example.com)')
    expect(html).toContain('<div class="table-wrap"><table>')
    expect(html).toContain('target="_blank"')
  })

  it('analyzes topics and word count identically to rendering', () => {
    const md = '## Eins\n\nDrei Wörter hier.\n\n## Eins\n\nNoch was.'
    const a = analyzeMarkdown(md)
    const r = renderMarkdown(md)
    expect(a.topics).toEqual(r.topics)
    expect(a.topics.map((t) => t.id)).toEqual(['eins', 'eins-1'])
    expect(a.wordCount).toBeGreaterThan(4)
  })
})
