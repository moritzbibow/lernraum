'use client'

import { useState } from 'react'
import styles from '../lists/Lists.module.css'

export function CopyField({ value, label = 'Kopieren' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className={styles.copy}>
      <code className={styles.copyValue}>{value}</code>
      <button
        type="button"
        className="btn btn-outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
          } catch {
            const area = document.createElement('textarea')
            area.value = value
            document.body.appendChild(area)
            area.select()
            document.execCommand('copy')
            area.remove()
          }
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1600)
        }}
      >
        {copied ? 'Kopiert ✓' : label}
      </button>
    </div>
  )
}
