'use client'

import { useApp } from '../providers/AppProviders'
import styles from '../dashboard/Dashboard.module.css'

export function LibrarySearch() {
  const { openPalette } = useApp()
  return (
    <button type="button" className={styles.search} onClick={() => openPalette()} aria-label="Suche öffnen">
      <span className={styles.searchIcon} aria-hidden />
      <span className={styles.searchText}>Seiten, Themen und Quizze durchsuchen …</span>
      <kbd className={styles.searchKbd}>⌘K</kbd>
    </button>
  )
}
