'use client'

import { useEffect } from 'react'

/** Replaces a diagram that cannot be drawn with a short note (source stays available). */
function showFallback(block: HTMLElement, source: string) {
  const label = document.createElement('span')
  label.className = 'mermaid-fallback__label'
  label.textContent = 'Diagramm'
  const note = document.createElement('p')
  note.className = 'mermaid-fallback__text'
  note.textContent = 'Dieses Diagramm konnte nicht dargestellt werden.'
  const details = document.createElement('details')
  const summary = document.createElement('summary')
  summary.textContent = 'Quelltext anzeigen'
  const pre = document.createElement('pre')
  pre.textContent = source
  details.append(summary, pre)
  block.replaceChildren(label, note, details)
  block.dataset.state = 'error'
}

/*
 * Diagram colours: node fills are the callout/subject tones (blue, violet, amber, green,
 * red) mixed into the surface colour (OKLab, 30 % dark / 38 % light), the root uses the
 * accent fill like the quiz card. Mermaid needs hex values, so they are precomputed.
 */
const ACCENT_FILL = '#a4dd98'
const PALETTE = {
  dark: { text: '#ece9e4', chip: '#2a2826', border: '#a4dd98', nodes: ['#374952', '#464353', '#524533', '#414d3b', '#553e38'] },
  light: { text: '#1c1b19', chip: '#eeebe5', border: '#48823b', nodes: ['#cde9f9', '#e4e0fb', '#f7e4ca', '#dcf0d5', '#fdd8d0'] },
}

function themeVariables(dark: boolean, token: (name: string) => string) {
  const p = dark ? PALETTE.dark : PALETTE.light
  const vars: Record<string, string | boolean> = {
    darkMode: dark,
    background: token('--surface'),
    fontSize: '14px',
    primaryColor: p.chip,
    primaryTextColor: p.text,
    primaryBorderColor: p.border,
    lineColor: token('--muted-2'),
    secondaryColor: token('--surface-2'),
    tertiaryColor: token('--surface'),
    // mindmap: root node + one colour per branch
    git0: ACCENT_FILL,
    gitBranchLabel0: '#131211',
  }
  for (let i = 1; i <= 11; i++) {
    vars[`cScale${i}`] = p.nodes[(i - 1) % p.nodes.length]
    vars[`cScaleLabel${i}`] = p.text
  }
  return vars
}

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
      const token = (name: string) => css.getPropertyValue(name).trim()
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        // Mermaid would otherwise draw its own error graphic into <body> and leave it there.
        suppressErrorRendering: true,
        theme: 'base',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        themeVariables: themeVariables(dark, token),
      })
      for (const [i, block] of blocks.entries()) {
        if (cancelled) return
        const source = block.dataset.source ?? block.textContent ?? ''
        block.dataset.source = source
        const id = `mmd-${containerId}-${i}-${Date.now()}`
        try {
          const { svg } = await mermaid.render(id, source)
          if (cancelled) return
          block.innerHTML = svg
          // Keep labels readable on phones: shrink to at most 72 % (≈ 10 px text), then the block scrolls sideways.
          const drawn = block.querySelector('svg')
          const natural = drawn?.viewBox.baseVal?.width
          if (drawn && natural) drawn.style.minWidth = `${Math.round(natural * 0.72)}px`
          block.dataset.state = 'done'
        } catch {
          // Remove temporary render containers mermaid may have left behind.
          for (const leftover of [id, `d${id}`, `i${id}`]) document.getElementById(leftover)?.remove()
          if (cancelled) return
          showFallback(block, source)
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
