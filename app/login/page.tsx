import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isLoggedIn } from '@/lib/auth/session'
import { appPassword } from '@/lib/env'
import { LoginForm } from './LoginForm'
import styles from './login.module.css'

export const metadata: Metadata = { title: 'Anmelden' }

type Props = { searchParams: Promise<{ next?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  if (await isLoggedIn()) redirect(target)
  const configured = Boolean(appPassword())
  const isOAuth = target.startsWith('/oauth/authorize')

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoDot} />
          <span className="serif">Lernraum</span>
        </div>
        <div className={styles.head}>
          <span className="label">{isOAuth ? 'Claude verbinden' : 'Willkommen zurück'}</span>
          <h1 className="serif">{isOAuth ? 'Erst anmelden, dann verbinden.' : 'Schön, dass du da bist.'}</h1>
        </div>
        {configured ? (
          <LoginForm next={target} />
        ) : (
          <p className={styles.warning}>
            Auf dem Server ist noch kein Passwort gesetzt. Lege <code>APP_PASSWORD</code> in der <code>.env</code> fest und starte
            den Lernraum neu.
          </p>
        )}
      </div>
    </main>
  )
}
