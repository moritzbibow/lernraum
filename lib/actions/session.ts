'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { safeEqual } from '../auth/crypto'
import { clientIp, rateLimit, resetRateLimit } from '../auth/rate-limit'
import { endSession, startSession } from '../auth/session'
import { appPassword } from '../env'

export type LoginState = { error: string | null }

/** Only allow same-site relative redirects after login. */
function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === 'string' ? next : '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/'
  return value
}

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const expected = appPassword()
  if (!expected) return { error: 'APP_PASSWORD ist auf dem Server nicht gesetzt (siehe .env).' }

  const ip = clientIp(await headers())
  const limit = rateLimit(`login:${ip}`, 8, 10 * 60 * 1000)
  if (!limit.ok) return { error: `Zu viele Versuche. Bitte in ${Math.ceil(limit.retryAfter / 60)} Min. erneut probieren.` }

  const password = String(form.get('password') ?? '')
  if (!password || !safeEqual(password, expected)) {
    await new Promise((r) => setTimeout(r, 400))
    return { error: 'Das Passwort stimmt nicht.' }
  }
  resetRateLimit(`login:${ip}`)
  await startSession()
  redirect(safeNext(form.get('next')))
}

export async function logoutAction(): Promise<void> {
  await endSession()
  redirect('/login')
}
