import fs from 'node:fs'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { databasePath, getDb, getSqlite } from '../db/client'
import { appMeta } from '../db/schema'
import { purgeDeleted } from './manage'

const KEEP_BACKUPS = 14

export function backupDir(): string {
  return process.env.BACKUP_DIR || path.join(path.dirname(databasePath()), 'backups')
}

function setMeta(key: string, value: string) {
  getDb().insert(appMeta).values({ key, value }).onConflictDoUpdate({ target: appMeta.key, set: { value } }).run()
}

export function getMeta(key: string): string | null {
  return getDb().select().from(appMeta).where(eq(appMeta.key, key)).get()?.value ?? null
}

/** Online backup of the SQLite database (safe while the app is running). */
export async function createBackup(): Promise<string> {
  const dir = backupDir()
  fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const file = path.join(dir, `lernraum-${stamp}.db`)
  await getSqlite().backup(file)
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^lernraum-.*\.db$/.test(f))
    .sort()
  for (const old of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) {
    fs.rmSync(path.join(dir, old), { force: true })
  }
  setMeta('lastBackupAt', String(Date.now()))
  return file
}

/** Daily housekeeping: purge soft-deleted items older than 7 days, expired OAuth rows, backup. */
export async function runDailyMaintenance(): Promise<void> {
  try {
    purgeDeleted(7)
    const { cleanupOAuth } = await import('../auth/oauth')
    cleanupOAuth()
  } catch (e) {
    console.error('[lernraum] Aufräumen fehlgeschlagen:', e)
  }
  if (process.env.BACKUP_DISABLED === '1' || databasePath() === ':memory:') return
  try {
    const file = await createBackup()
    console.log(`[lernraum] Backup erstellt: ${file}`)
  } catch (e) {
    console.error('[lernraum] Backup fehlgeschlagen:', e)
  }
}

/** Schedules maintenance shortly after start and then every night at ~03:15 (server time). */
export function scheduleMaintenance(): void {
  const g = globalThis as unknown as { __lernraumMaintenance?: boolean }
  if (g.__lernraumMaintenance) return
  g.__lernraumMaintenance = true

  const msUntilNext = () => {
    const now = new Date()
    const next = new Date(now)
    next.setHours(3, 15, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    return next.getTime() - now.getTime()
  }
  const loop = () => {
    setTimeout(async () => {
      await runDailyMaintenance()
      loop()
    }, msUntilNext()).unref?.()
  }
  // A first run a minute after start (covers servers that restart nightly).
  setTimeout(() => {
    const last = Number(getMeta('lastBackupAt') ?? 0)
    if (Date.now() - last > 20 * 60 * 60 * 1000) void runDailyMaintenance()
  }, 60_000).unref?.()
  loop()
}
