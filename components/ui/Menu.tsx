'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import styles from './Menu.module.css'

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean; hint?: string }

type Props = {
  items: MenuItem[]
  /** Renders the trigger; receives the toggle handler. */
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactNode
  align?: 'left' | 'right'
}

export function Menu({ items, trigger, align = 'right' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={styles.wrap} ref={ref}>
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      {open && (
        <div className={`${styles.menu} ${align === 'left' ? styles.left : ''}`} role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={`${styles.item} ${item.danger ? styles.danger : ''}`}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
            >
              <span>{item.label}</span>
              {item.hint && <span className={styles.hint}>{item.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
