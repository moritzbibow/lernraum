/** German date/time helpers. The server runs with TZ=Europe/Berlin. */

const DAY = 24 * 60 * 60 * 1000

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** "DONNERSTAG, 24. SEPTEMBER" (uppercase is applied via CSS). */
export function formatLongDate(ts: number): string {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(ts)
}

/** "Do, 24. Sept." */
export function formatShortDate(ts: number): string {
  const d = new Date(ts)
  const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(d).replace('.', '')
  const month = new Intl.DateTimeFormat('de-DE', { month: 'short' }).format(d)
  return `${weekday}, ${d.getDate()}. ${month}${month.endsWith('.') ? '' : '.'}`
}

export function greeting(ts: number): string {
  const h = new Date(ts).getHours()
  if (h >= 5 && h < 11) return 'Guten Morgen'
  if (h >= 11 && h < 18) return 'Guten Tag'
  if (h >= 18 && h < 23) return 'Guten Abend'
  return 'Gute Nacht'
}

/** "vor 12 Min.", "heute", "gestern", "Mo.", "29.08." – as in the Verwalten table. */
export function formatChanged(ts: number, now = Date.now()): string {
  const diff = now - ts
  if (diff < 60_000) return 'gerade eben'
  if (diff < 60 * 60_000) return `vor ${Math.floor(diff / 60_000)} Min.`
  const today = startOfDay(now)
  if (ts >= today) return 'heute'
  if (ts >= today - DAY) return 'gestern'
  if (ts >= today - 6 * DAY) {
    return new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(ts).replace(/\.?$/, '.')
  }
  const d = new Date(ts)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  if (d.getFullYear() !== new Date(now).getFullYear()) return `${dd}.${mm}.${String(d.getFullYear()).slice(2)}`
  return `${dd}.${mm}.`
}

/** "12 Min.", "3 Std.", "gestern", "Mo.", "29.08." – for the "Frisch eingespeist" list. */
export function formatAge(ts: number, now = Date.now()): string {
  const diff = now - ts
  if (diff < 60_000) return 'jetzt'
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)} Min.`
  const today = startOfDay(now)
  if (ts >= today) return `${Math.floor(diff / (60 * 60_000))} Std.`
  return formatChanged(ts, now)
}

/** "Heute", "Gestern", "Montag, 21. September" – for grouping lists by day. */
export function formatDayGroup(ts: number, now = Date.now()): string {
  const today = startOfDay(now)
  if (ts >= today) return 'Heute'
  if (ts >= today - DAY) return 'Gestern'
  return formatLongDate(ts)
}

/** "12.09." */
export function formatDayMonth(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`
}

/** "12. September" from an ISO date (YYYY-MM-DD). */
export function formatLessonDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' }).format(new Date(y, m - 1, d))
}

export function percent(fraction: number): number {
  return Math.round(Math.max(0, Math.min(1, fraction)) * 100)
}
