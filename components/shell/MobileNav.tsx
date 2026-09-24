'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApp } from '../providers/AppProviders'
import styles from './Shell.module.css'

/** Bottom pill navigation on phones: Start · Bibliothek · Eingang. */
export function MobileNav() {
  const pathname = usePathname()
  const { unseen } = useApp()
  const section = pathname === '/' ? 'start' : pathname.startsWith('/eingang') ? 'inbox' : 'library'
  return (
    <nav className={styles.mobileNav} aria-label="Navigation">
      <Link href="/" className={`${styles.mItem} ${section === 'start' ? styles.mActive : ''}`}>
        Start
      </Link>
      <Link href="/bibliothek" className={`${styles.mItem} ${section === 'library' ? styles.mActive : ''}`}>
        Bibliothek
      </Link>
      <Link href="/eingang" className={`${styles.mItem} ${section === 'inbox' ? styles.mActive : ''}`}>
        Eingang{unseen > 0 && <span className={styles.mCount}>{unseen}</span>}
      </Link>
    </nav>
  )
}
