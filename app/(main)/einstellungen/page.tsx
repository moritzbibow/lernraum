import type { Metadata } from 'next'
import { headers } from 'next/headers'
import styles from '@/components/lists/Lists.module.css'
import { ThemeSwitch } from '@/components/shell/ThemeToggle'
import { CopyField } from '@/components/ui/CopyField'
import { logoutAction } from '@/lib/actions/session'
import { backupNowAction, disconnectClientAction } from '@/lib/actions/settings'
import { listConnectedClients } from '@/lib/auth/oauth'
import { apiToken, baseUrl, mcpUrlSecret } from '@/lib/env'
import { formatChanged, serverNow } from '@/lib/format'
import { getMeta } from '@/lib/services/maintenance'

export const metadata: Metadata = { title: 'Einstellungen' }

export default async function SettingsPage() {
  const base = baseUrl(await headers())
  const mcpUrl = `${base}/api/mcp`
  const clients = listConnectedClients()
  const lastBackup = Number(getMeta('lastBackupAt') ?? 0)
  const hasToken = Boolean(apiToken())
  const now = serverNow()

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <span className={`label ${styles.kicker}`}>Lernraum</span>
          <h1 className={`serif ${styles.title}`}>Einstellungen</h1>
        </div>
      </header>

      <section className={styles.panel}>
        <h2 className={`serif ${styles.panelTitle}`}>Darstellung</h2>
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>
            Dunkler Modus
            <span className={styles.settingHint}>Standard ist dunkel. Wird auf diesem Gerät gespeichert.</span>
          </span>
          <ThemeSwitch />
        </div>
      </section>

      <section className={styles.panel} id="claude">
        <h2 className={`serif ${styles.panelTitle}`}>Claude verbinden</h2>
        <p className={styles.panelText}>
          Über diesen Connector kann Claude direkt aus dem Chat Lernseiten und Quizze einspeisen, die Struktur lesen und
          bestehende Seiten überarbeiten. Alles ist sofort hier online.
        </p>
        <CopyField value={mcpUrl} label="URL kopieren" />
        <ol className={styles.steps}>
          <li>
            In claude.ai (oder der Claude-App): <strong>Einstellungen → Connectors → Benutzerdefinierten Connector hinzufügen</strong>.
          </li>
          <li>Name „Lernraum“, die URL oben einfügen und hinzufügen.</li>
          <li>
            Auf <strong>Verbinden</strong> klicken, hier mit deinem Lernraum-Passwort anmelden und <strong>Zulassen</strong> wählen.
          </li>
          <li>Im Chat den Connector aktivieren und z. B. schreiben: „Speise diesen Lernzettel in Sport › Sporttheorie ein.“</li>
        </ol>

        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>
            Claude Code / Skripte
            <span className={styles.settingHint}>
              Statischer Token aus der <code>.env</code> (<code>LERNRAUM_API_TOKEN</code>):{' '}
              {hasToken ? <span className={styles.ok}>gesetzt ✓</span> : <span className={styles.warn}>nicht gesetzt</span>}
            </span>
          </span>
        </div>
        <CopyField value={`claude mcp add --transport http lernraum ${mcpUrl} --header "Authorization: Bearer $LERNRAUM_API_TOKEN"`} />
        {mcpUrlSecret() && (
          <p className={styles.settingHint}>Fallback aktiv: MCP zusätzlich unter einer geheimen URL ohne OAuth erreichbar (MCP_URL_SECRET).</p>
        )}

        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>
            Verbundene Clients
            <span className={styles.settingHint}>
              {clients.length ? 'Diese Apps haben Zugriff per OAuth.' : 'Noch keine Verbindung per OAuth.'}
            </span>
          </span>
        </div>
        {clients.length > 0 && (
          <div className={styles.clients}>
            {clients.map((c) => (
              <form key={c.id} action={disconnectClientAction} className={styles.client}>
                <input type="hidden" name="clientId" value={c.id} />
                <span className={styles.clientName}>
                  {c.name}
                  <span className={styles.settingHint}>
                    {' '}
                    · verbunden {formatChanged(c.createdAt, now)}
                    {c.lastUsedAt ? ` · zuletzt aktiv ${formatChanged(c.lastUsedAt, now)}` : ''}
                  </span>
                </span>
                <button type="submit" className="btn btn-danger">
                  Trennen
                </button>
              </form>
            ))}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <h2 className={`serif ${styles.panelTitle}`}>Daten</h2>
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>
            Export
            <span className={styles.settingHint}>Alle Fächer, Seiten (Markdown), Quizze und Ergebnisse als JSON.</span>
          </span>
          <a href="/api/export" className="btn btn-outline" download>
            Herunterladen
          </a>
        </div>
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>
            Backup
            <span className={styles.settingHint}>
              Automatisch jede Nacht (14 Stück werden aufbewahrt).{' '}
              {lastBackup ? `Letztes: ${formatChanged(lastBackup, now)}.` : 'Noch keins erstellt.'}
            </span>
          </span>
          <form action={backupNowAction}>
            <button type="submit" className="btn btn-outline">
              Jetzt sichern
            </button>
          </form>
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={`serif ${styles.panelTitle}`}>Konto</h2>
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>
            Abmelden
            <span className={styles.settingHint}>Beendet die Sitzung auf diesem Gerät.</span>
          </span>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-outline">
              Abmelden
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
