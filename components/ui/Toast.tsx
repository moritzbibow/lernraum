'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import styles from './Toast.module.css'

export type ToastInput = {
  message: string
  action?: { label: string; onClick: () => void | Promise<void> }
  /** ms, default 4000 (10 000 with an action, e.g. "Rückgängig") */
  duration?: number
  tone?: 'default' | 'error'
}

type ToastItem = ToastInput & { id: number; duration: number }

const ToastContext = createContext<(t: ToastInput) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), [])

  const toast = useCallback((t: ToastInput) => {
    const id = nextId.current++
    const duration = t.duration ?? (t.action ? 10_000 : 4000)
    setItems((list) => [...list.slice(-2), { ...t, id, duration }])
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {items.map((t) => (
          <Toast key={t.id} item={t} onDone={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function Toast({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(onDone, item.duration)
    return () => window.clearTimeout(id)
  }, [item.duration, onDone])

  return (
    <div className={`${styles.toast} ${item.tone === 'error' ? styles.error : ''}`}>
      <span className={styles.message}>{item.message}</span>
      {item.action && (
        <button
          type="button"
          className={styles.action}
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await item.action!.onClick()
            } finally {
              onDone()
            }
          }}
        >
          {item.action.label}
        </button>
      )}
      <span className={styles.timer} style={{ animationDuration: `${item.duration}ms` }} />
    </div>
  )
}
