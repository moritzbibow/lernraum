'use client'

import { useState, type ReactNode } from 'react'
import { Modal, ModalFooter } from './Modal'

type PromptProps = {
  open: boolean
  onClose: () => void
  title: string
  kicker?: string
  label: string
  initialValue?: string
  placeholder?: string
  submitLabel: string
  /** Return an error message to keep the dialog open. */
  onSubmit: (value: string) => Promise<string | void> | string | void
  children?: ReactNode
}

/** Single text field dialog (new subject/folder, rename). */
export function PromptDialog({ open, onClose, title, kicker, ...rest }: PromptProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} kicker={kicker}>
      {/* Mounted only while open → fresh state every time. */}
      <PromptBody onClose={onClose} {...rest} />
    </Modal>
  )
}

function PromptBody({
  onClose,
  label,
  initialValue = '',
  placeholder,
  submitLabel,
  onSubmit,
  children,
}: Omit<PromptProps, 'open' | 'title' | 'kicker'>) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!value.trim() || busy) return
    setBusy(true)
    try {
      const err = await onSubmit(value.trim())
      if (err) setError(err)
      else onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <label className="field">
        <span className="field-label">{label}</span>
        <input
          className="input"
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          maxLength={200}
          autoFocus
        />
      </label>
      {children}
      {error && <p style={{ color: 'var(--danger-text)', fontSize: 13 }}>{error}</p>}
      <ModalFooter>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Abbrechen
        </button>
        <button type="submit" className="btn btn-accent" disabled={!value.trim() || busy}>
          {submitLabel}
        </button>
      </ModalFooter>
    </form>
  )
}

type ConfirmProps = {
  open: boolean
  onClose: () => void
  title: string
  kicker?: string
  message: ReactNode
  confirmLabel: string
  danger?: boolean
  onConfirm: () => Promise<void> | void
}

export function ConfirmDialog({ open, onClose, title, kicker, message, confirmLabel, danger, onConfirm }: ConfirmProps) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      kicker={kicker}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className={danger ? 'btn btn-danger-fill' : 'btn btn-accent'}
            disabled={busy}
            autoFocus
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
                onClose()
              } finally {
                setBusy(false)
              }
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-2)' }}>{message}</div>
    </Modal>
  )
}
