/** Runs once when the server starts: migrate the DB and schedule nightly maintenance. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { getDb } = await import('./lib/db/client')
  getDb() // opens + migrates the SQLite database before the first request
  const { scheduleMaintenance } = await import('./lib/services/maintenance')
  scheduleMaintenance()
}
