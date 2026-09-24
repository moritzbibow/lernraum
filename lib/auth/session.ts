import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { secureCookies } from '../env'
import { createSessionToken, SESSION_COOKIE, verifySessionToken } from './session-core'

export async function isLoggedIn(): Promise<boolean> {
  const store = await cookies()
  return verifySessionToken(store.get(SESSION_COOKIE)?.value)
}

/** For server components, layouts and actions: redirects to /login when not signed in. */
export async function requireSession(): Promise<void> {
  if (await isLoggedIn()) return
  const h = await headers()
  const next = h.get('x-lernraum-path') ?? '/'
  redirect(`/login?next=${encodeURIComponent(next)}`)
}

/** For server actions: throws instead of redirecting. */
export async function assertSession(): Promise<void> {
  if (!(await isLoggedIn())) throw new Error('Nicht angemeldet.')
}

export async function startSession(): Promise<void> {
  const { value, expires } = createSessionToken()
  const store = await cookies()
  store.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies(),
    path: '/',
    expires,
  })
}

export async function endSession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}
