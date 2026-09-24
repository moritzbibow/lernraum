'use client'

import { useEffect } from 'react'

/** Renders ```mermaid blocks (lazy-loads mermaid only on pages that need it). */
export function MermaidRenderer({ containerId }: { containerId: string }) {
  useEffect(() => {
    let cancelled = false
    const render = async () => {
      const blocks = Array.from(document.querySelectorAll<HTMLElement>(`#${containerId} .mermaid-block`))
      if (blocks.length === 0) return
      const { default: mermaid } = await import('mermaid')
      const dark = document.documentElement.dataset.theme !== 'light'
      const css = getComputedStyle(document.documentElement)
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        themeVariables: {
          darkMode: dark,
          background: css.getPropertyValue('--surface').trim(),
          primaryColor: dark ? '#2a2826' : '#eeebe5',
          primaryTextColor: css.getPropertyValue('--text').trim(),
          primaryBorderColor: dark ? '#a4dd98' : '#48823b',
          lineColor: css.getPropertyValue('--muted-2').trim(),
          secondaryColor: dark ? '#1f1d1b' : '#f0ede7',
          tertiaryColor: css.getPropertyValue('--surface').trim(),
          fontSize: '14px',
        },
      })
      for (const [i, block] of blocks.entries()) {
        if (cancelled) return
        const source = block.dataset.source ?? block.textContent ?? ''
        block.dataset.source = source
        try {
          const { svg } = await mermaid.render(`mmd-${containerId}-${i}-${Date.now()}`, source)
          if (cancelled) return
          block.innerHTML = svg
          block.dataset.state = 'done'
        } catch {
          block.textContent = source
          block.dataset.state = 'error'
        }
      }
    }
    void render()
    const onTheme = () => void render()
    window.addEventListener('lernraum:theme', onTheme)
    return () => {
      cancelled = true
      window.removeEventListener('lernraum:theme', onTheme)
    }
  }, [containerId])
  return null
}
