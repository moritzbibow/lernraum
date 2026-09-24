'use client'

import { useActionState } from 'react'
import { loginAction, type LoginState } from '@/lib/actions/session'
import styles from './login.module.css'

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { error: null })
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span className="field-label">Passwort</span>
        <input
          className={`input ${styles.input}`}
          type="password"
          name="password"
          autoComplete="current-password"
          autoFocus
          required
          placeholder="••••••••"
        />
      </label>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className={`btn btn-accent ${styles.submit}`} disabled={pending}>
        {pending ? 'Prüfe …' : 'Anmelden'}
      </button>
    </form>
  )
}
