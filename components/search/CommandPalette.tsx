'use client'

import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { SearchResult } from '@/lib/services/search'
import { normalizeForMatch } from '@/lib/text'
import { useApp } from '../providers/AppProviders'
import styles from './CommandPalette.module.css'

type Props = { open: boolean; onOpenChange: (open: boolean) => void; initialQuery?: string }

type NavCommand = { id: string; label: string; hint?: string; run: () => void; keywords: string[] }

const KIND_LABEL: Record<SearchResult['kind'], string> = { page: 'Lernseite', quiz: 'Quiz', subject: 'Fach' }

export function CommandPalette({ open, onOpenChange, initialQuery = '' }: Props) {
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Suche"
      shouldFilter={false}
      loop
      overlayClassName={styles.overlay}
      contentClassName={styles.content}
    >
      {open && <PaletteBody initialQuery={initialQuery} onOpenChange={onOpenChange} />}
    </Command.Dialog>
  )
}

function PaletteBody({ initialQuery, onOpenChange }: { initialQuery: string; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const { tree, theme, setTheme } = useApp()
  const [query, setQuery] = useState(initialQuery)
  const [response, setResponse] = useState<{ query: string; results: SearchResult[] }>({ query: '', results: [] })
  const requestId = useRef(0)

  // Debounced server search (FTS over titles, topics and content).
  useEffect(() => {
    const q = query.trim()
    if (!q) return
    const id = ++requestId.current
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' })
        const data = (await res.json()) as { results: SearchResult[] }
        if (id === requestId.current) setResponse({ query: q, results: data.results ?? [] })
      } catch {
        if (id === requestId.current) setResponse({ query: q, results: [] })
      }
    }, 140)
    return () => window.clearTimeout(t)
  }, [query])

  const trimmed = query.trim()
  const results = trimmed ? response.results : []
  const loading = Boolean(trimmed) && response.query !== trimmed

  const go = (url: string) => {
    onOpenChange(false)
    router.push(url)
  }

  const commands: NavCommand[] = useMemo(
    () => [
      { id: 'nav-home', label: 'Übersicht', run: () => go('/'), keywords: ['start', 'dashboard', 'home'] },
      { id: 'nav-inbox', label: 'Eingang', run: () => go('/eingang'), keywords: ['neu', 'inbox', 'claude'] },
      { id: 'nav-quizzes', label: 'Alle Quizze', run: () => go('/quizze'), keywords: ['quiz', 'üben'] },
      { id: 'nav-library', label: 'Bibliothek', run: () => go('/bibliothek'), keywords: ['fächer', 'seiten'] },
      { id: 'nav-manage', label: 'Verwalten', run: () => go('/verwalten'), keywords: ['verschieben', 'löschen', 'umbenennen', 'ordner', 'fach'] },
      { id: 'nav-settings', label: 'Einstellungen', run: () => go('/einstellungen'), keywords: ['claude', 'verbinden', 'export', 'mcp'] },
      {
        id: 'theme',
        label: theme === 'dark' ? 'Heller Modus' : 'Dunkler Modus',
        hint: 'Darstellung',
        run: () => {
          setTheme(theme === 'dark' ? 'light' : 'dark')
          onOpenChange(false)
        },
        keywords: ['theme', 'hell', 'dunkel', 'dark', 'light', 'modus'],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme],
  )

  const q = normalizeForMatch(query)
  const matchingCommands = q
    ? commands.filter((c) => normalizeForMatch(c.label).includes(q) || c.keywords.some((k) => k.includes(q)))
    : commands
  const pages = results.filter((r) => r.kind === 'page')
  const quizzes = results.filter((r) => r.kind === 'quiz')
  const subjects = results.filter((r) => r.kind === 'subject')

  const renderResult = (r: SearchResult) => (
    <Command.Item key={`${r.kind}-${r.id}`} value={`${r.kind}-${r.id}`} onSelect={() => go(r.url)} className={styles.item}>
      <span
        className={styles.kind}
        data-subject={r.hue !== null && r.hue !== undefined ? '' : undefined}
        style={r.hue !== null && r.hue !== undefined ? { ['--sh' as string]: r.hue } : undefined}
      >
        {KIND_LABEL[r.kind]}
      </span>
      <span className={styles.main}>
        <span className={styles.title}>{r.title}</span>
        {r.path && r.kind !== 'subject' && <span className={styles.path}>{r.path}</span>}
        {r.snippet && <span className={styles.snippet} dangerouslySetInnerHTML={{ __html: r.snippet }} />}
      </span>
    </Command.Item>
  )

  return (
    <>
      <div className={styles.inputRow}>
        <span className={styles.icon} aria-hidden />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Was willst du lernen? Seiten, Themen, Quizze …"
          className={styles.input}
        />
        <kbd className={styles.kbd}>esc</kbd>
      </div>
      <Command.List className={styles.list}>
        {trimmed && !loading && results.length === 0 && matchingCommands.length === 0 && (
          <Command.Empty className={styles.empty}>Nichts gefunden für „{query.trim()}“.</Command.Empty>
        )}
        {pages.length > 0 && (
          <Command.Group heading="Lernseiten" className={styles.group}>
            {pages.map(renderResult)}
          </Command.Group>
        )}
        {quizzes.length > 0 && (
          <Command.Group heading="Quizze" className={styles.group}>
            {quizzes.map(renderResult)}
          </Command.Group>
        )}
        {subjects.length > 0 && (
          <Command.Group heading="Fächer" className={styles.group}>
            {subjects.map(renderResult)}
          </Command.Group>
        )}
        {!query.trim() && tree.subjects.length > 0 && (
          <Command.Group heading="Fächer" className={styles.group}>
            {tree.subjects.map((s) => (
              <Command.Item key={s.id} value={`subject-${s.id}`} onSelect={() => go(s.url)} className={styles.item}>
                <span
                  className="dot"
                  data-subject=""
                  style={{ ['--sh' as string]: s.color?.hue, ['--sl' as string]: s.color?.lightness, ['--sc' as string]: s.color?.chroma }}
                />
                <span className={styles.title}>{s.title}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {matchingCommands.length > 0 && (
          <Command.Group heading="Gehe zu" className={styles.group}>
            {matchingCommands.map((c) => (
              <Command.Item key={c.id} value={c.id} onSelect={c.run} className={styles.item}>
                <span className={styles.title}>{c.label}</span>
                {c.hint && <span className={styles.hint}>{c.hint}</span>}
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
      <div className={styles.footer}>
        <span>↑↓ navigieren</span>
        <span>↵ öffnen</span>
        <span>esc schließen</span>
        {loading && <span className={styles.loading}>sucht …</span>}
      </div>
    </>
  )
}
