import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import fs from 'node:fs'
import path from 'node:path'
import * as schema from './schema'

export type DB = BetterSQLite3Database<typeof schema>
/** A database handle or an open transaction – services accept both. */
export type Tx = DB | Parameters<Parameters<DB['transaction']>[0]>[0]

type Handle = { db: DB; sqlite: Database.Database; file: string }

// Survives Next.js hot reloads: one connection per process.
const g = globalThis as unknown as { __lernraumDb?: Handle }

export function databasePath(): string {
  return process.env.DATABASE_PATH || path.join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'lernraum.db')
}

function migrationsFolder(): string {
  const candidates = [process.env.MIGRATIONS_PATH, path.join(/*turbopackIgnore: true*/ process.cwd(), 'drizzle')]
  for (const dir of candidates) {
    if (dir && fs.existsSync(/*turbopackIgnore: true*/ path.join(dir, 'meta', '_journal.json'))) return dir
  }
  throw new Error('Migrationsordner "drizzle/" nicht gefunden (MIGRATIONS_PATH setzen).')
}

function open(file: string): Handle {
  if (file !== ':memory:') fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true })
  const sqlite = new Database(file)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  sqlite.pragma('synchronous = NORMAL')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: migrationsFolder() })
  return { db, sqlite, file }
}

/** Lazily opens (and migrates) the SQLite database on first use. */
export function getDb(): DB {
  if (!g.__lernraumDb) g.__lernraumDb = open(databasePath())
  return g.__lernraumDb.db
}

export function getSqlite(): Database.Database {
  getDb()
  return g.__lernraumDb!.sqlite
}

/** Tests only: replace the process-wide database with a fresh one. */
export function resetDbForTests(file = ':memory:'): DB {
  g.__lernraumDb?.sqlite.close()
  g.__lernraumDb = open(file)
  return g.__lernraumDb.db
}

export { schema }
