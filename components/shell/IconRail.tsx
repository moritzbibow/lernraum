'use client'

import { FolderTree, Inbox, LayoutGrid, ListChecks, Moon, Sun } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApp } from '../providers/AppProviders'
import styles from './Shell.module.css'

const ITEMS = [
  { href: '/', label: 'Übersicht', Icon: LayoutGrid, match: (p: string) => p === '/' },
  { href: '/eingang', label: 'Eingang', Icon: Inbox, match: (p: string) => p.startsWith('/eingang') },
  { href: '/quizze', label: 'Alle Quizze', Icon: ListChecks, match: (p: string) => p.startsWith('/quiz') },
  { href: '/verwalten', label: 'Verwalten', Icon: FolderTree, match: (p: string) => p.startsWith('/verwalten') },
]

/** 72px rail for focus screens (Quiz bearbeiten, Verwalten). */
export function IconRail() {
  const pathname = usePathname()
  const { unseen, theme, setTheme } = useApp()
  return (
    <aside className={styles.rail}>
      <Link href="/" className={styles.railLogo} aria-label="Lernraum – Übersicht" title="Lernraum" />
      <nav className={styles.railIcons} aria-label="Hauptnavigation">
        {ITEMS.map(({ href, label, Icon, match }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.railBtn} ${match(pathname) ? styles.railActive : ''}`}
            title={label}
            aria-label={label}
          >
            <Icon size={18} strokeWidth={1.5} />
            {href === '/eingang' && unseen > 0 && <span className={styles.railBadge} />}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        className={`${styles.railBtn} ${styles.railBottom}`}
        title={theme === 'dark' ? 'Heller Modus' : 'Dunkler Modus'}
        aria-label={theme === 'dark' ? 'Heller Modus' : 'Dunkler Modus'}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
      </button>
    </aside>
  )
}
