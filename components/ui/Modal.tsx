'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Modal.module.css'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  kicker?: string
  children: ReactNode
  footer?: ReactNode
  width?: number
}

/** Native <dialog> with the app's styling (focus trap + Escape for free). */
/** Footer row with the modal's button layout (for bodies that render their own buttons). */
export function ModalFooter({ children }: { children: ReactNode }) {
  return <footer className={styles.footer}>{children}</footer>
}

export function Modal({ open, onClose, title, kicker, children, footer, width = 440 }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onMouseDown={(e) => {
        // click on the backdrop closes
        if (e.target === ref.current) onClose()
      }}
    >
      {open && (
        <div className={styles.inner}>
          <header className={styles.header}>
            {kicker && <span className={`label ${styles.kicker}`}>{kicker}</span>}
            <h2 className={`serif ${styles.title}`}>{title}</h2>
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
