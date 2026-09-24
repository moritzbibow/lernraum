'use client'

import { useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { LibraryTree } from '@/lib/services/tree'
import { CommandPalette } from '../search/CommandPalette'
import { ToastProvider } from '../ui/Toast'
import { applyTheme, currentTheme, type Theme } from './theme'

type AppContextValue = {
  tree: LibraryTree
  openPalette: (initialQuery?: string) => void
  theme: Theme
  setTheme: (theme: Theme) => void
  unseen: number
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProviders>')
  return ctx
}

type Props = {
  tree: LibraryTree
  theme: Theme
  inbox: { unseen: number; latest: number }
  children: ReactNode
}

/** Client-side app state: theme, ⌘K palette, toasts, live refresh when Claude ingests. */
export function AppProviders({ tree, theme: initialTheme, inbox, children }: Props) {
  const router = useRouter()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  const openPalette = useCallback((initialQuery = '') => {
    setPaletteQuery(initialQuery)
    setPaletteOpen(true)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    applyTheme(t)
    setThemeState(t)
  }, [])

  // Keep in sync if the theme is changed elsewhere (e.g. palette command).
  useEffect(() => {
    const onTheme = () => setThemeState(currentTheme())
    window.addEventListener('lernraum:theme', onTheme)
    return () => window.removeEventListener('lernraum:theme', onTheme)
  }, [])

  // ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteQuery('')
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Live update: when Claude ingests something, refresh server data (badge, lists).
  const signature = useRef(inbox)
  useEffect(() => {
    signature.current = inbox
  }, [inbox])
  useEffect(() => {
    let stopped = false
    const check = async () => {
      if (document.hidden || stopped) return
      try {
        const res = await fetch('/api/inbox', { cache: 'no-store' })
        if (!res.ok) return
        const next = (await res.json()) as { unseen: number; latest: number }
        const prev = signature.current
        if (next.latest !== prev.latest || next.unseen !== prev.unseen) {
          signature.current = next
          router.refresh()
        }
      } catch {
        // offline – try again later
      }
    }
    const id = window.setInterval(check, 20_000)
    const onVisible = () => {
      if (!document.hidden) void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router])

  const value = useMemo(
    () => ({ tree, openPalette, theme, setTheme, unseen: inbox.unseen }),
    [tree, openPalette, theme, setTheme, inbox.unseen],
  )

  return (
    <AppContext.Provider value={value}>
      <ToastProvider>
        {children}
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} initialQuery={paletteQuery} />
      </ToastProvider>
    </AppContext.Provider>
  )
}
