'use client'

import { useApp } from '../providers/AppProviders'
import styles from './Dashboard.module.css'

/** Looks like a search field, opens the ⌘K palette (full-text search). */
export function SearchHero() {
  const { openPalette } = useApp()
  return (
    <button type="button" className={styles.search} onClick={() => openPalette()} aria-label="Suche öffnen">
      <span className={styles.searchIcon} aria-hidden />
      <span className={styles.searchText}>
        <span className={styles.searchLong}>Was willst du lernen? z. B. „Superkompensation“</span>
        <span className={styles.searchShort}>Was willst du lernen?</span>
      </span>
      <kbd className={styles.searchKbd}>⌘K</kbd>
    </button>
  )
}
