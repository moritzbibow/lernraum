'use client'

import { useApp } from '../providers/AppProviders'
import styles from './Shell.module.css'

/** 40×22 switch – "an" = dunkler Modus (design 2a). */
export function ThemeSwitch({ label = 'Dunkler Modus' }: { label?: string }) {
  const { theme, setTheme } = useApp()
  const on = theme === 'dark'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={styles.toggle}
      onClick={() => setTheme(on ? 'light' : 'dark')}
    >
      <span className={styles.knob} />
    </button>
  )
}
