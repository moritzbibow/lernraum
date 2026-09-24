#!/usr/bin/env node
/**
 * Manuelles Backup der SQLite-Datenbank (sicher im laufenden Betrieb).
 *   docker compose exec app node scripts/backup.mjs
 * Legt /data/backups/lernraum-manual-<zeit>.db an.
 */
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const file = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'lernraum.db')
if (!fs.existsSync(file)) {
  console.error(`Datenbank nicht gefunden: ${file}`)
  process.exit(1)
}
const dir = process.env.BACKUP_DIR || path.join(path.dirname(file), 'backups')
fs.mkdirSync(dir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const target = path.join(dir, `lernraum-manual-${stamp}.db`)
const db = new Database(file, { readonly: true })
await db.backup(target)
db.close()
console.log(`Backup erstellt: ${target}`)
