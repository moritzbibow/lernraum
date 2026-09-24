import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { decideAuthorizationAction } from '@/lib/actions/oauth'
import { buildRedirect, validateAuthorizeRequest } from '@/lib/auth/oauth'
import { resourceUrl } from '@/lib/auth/oauth-metadata'
import { requireSession } from '@/lib/auth/session'
import { baseUrl } from '@/lib/env'
import styles from '../../login/login.module.css'

export const metadata: Metadata = { title: 'Claude verbinden' }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const FIELDS = ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'scope', 'resource'] as const

export default async function AuthorizePage({ searchParams }: Props) {
  await requireSession()
  const sp = await searchParams
  const one = (k: string) => {
    const v = sp[k]
    return typeof v === 'string' ? v : Array.isArray(v) ? (v[0] ?? null) : null
  }
  const params = Object.fromEntries(FIELDS.map((k) => [k, one(k)])) as Record<(typeof FIELDS)[number], string | null>
  const h = await headers()
  const issuer = baseUrl(h)
  const result = validateAuthorizeRequest(params, [resourceUrl(h), issuer])

  if (!result.ok && result.redirectable) {
    redirect(buildRedirect(result.redirectUri, { error: result.error, error_description: result.description, state: result.state, iss: issuer }))
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoDot} />
          <span className="serif">Lernraum</span>
        </div>
        {!result.ok ? (
          <>
            <div className={styles.head}>
              <span className="label">Verbindung nicht möglich</span>
              <h1 className="serif">Diese Anfrage ist ungültig.</h1>
            </div>
            <p className={styles.warning}>{result.description} Bitte den Connector in Claude entfernen und neu hinzufügen.</p>
          </>
        ) : (
          <>
            <div className={styles.head}>
              <span className="label">Claude verbinden</span>
              <h1 className="serif">„{result.request.client.name}“ möchte auf deinen Lernraum zugreifen.</h1>
            </div>
            <ul className={styles.perms}>
              <li>Struktur, Lernseiten und Quizze lesen und durchsuchen</li>
              <li>Neue Lernseiten und Quizze einspeisen und bestehende aktualisieren</li>
              <li>Kein Löschen, kein Zugriff auf dein Passwort</li>
            </ul>
            <p className={styles.redirectInfo}>
              Weiterleitung nach <code>{new URL(result.request.redirectUri).host}</code>
            </p>
            <form action={decideAuthorizationAction} className={styles.form}>
              {FIELDS.map((k) => (params[k] ? <input key={k} type="hidden" name={k} value={params[k] ?? ''} /> : null))}
              <div className={styles.decide}>
                <button type="submit" name="decision" value="deny" className="btn btn-outline">
                  Ablehnen
                </button>
                <button type="submit" name="decision" value="allow" className={`btn btn-accent ${styles.submit}`}>
                  Zulassen
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
