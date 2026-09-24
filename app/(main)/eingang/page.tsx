import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '@/components/lists/Lists.module.css'
import { markAllSeenAction } from '@/lib/actions/library'
import { formatAge, formatDayGroup, serverNow } from '@/lib/format'
import { listInbox, unseenCount } from '@/lib/services/inbox'

export const metadata: Metadata = { title: 'Eingang' }

async function markAll() {
  'use server'
  await markAllSeenAction()
}

export default function InboxPage() {
  const now = serverNow()
  const items = listInbox({ limit: 200 })
  const unseen = unseenCount()
  const groups = new Map<string, typeof items>()
  for (const item of items) {
    const key = formatDayGroup(item.createdAt, now)
    groups.set(key, [...(groups.get(key) ?? []), item])
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <span className={`label ${styles.kicker}`}>Via Claude · sofort online</span>
          <h1 className={`serif ${styles.title}`}>Eingang</h1>
          <p className={styles.sub}>
            {unseen > 0 ? `${unseen} neu` : 'Alles gesehen'} · Alles, was Claude eingespeist hat, landet hier.
          </p>
        </div>
        {unseen > 0 && (
          <form action={markAll} className={styles.headActions}>
            <button type="submit" className="btn btn-outline">
              Alle als gesehen markieren
            </button>
          </form>
        )}
      </header>

      {items.length === 0 && (
        <div className={styles.empty}>
          <span className={`serif ${styles.emptyTitle}`}>Noch nichts eingespeist.</span>
          <span>
            Verbinde Claude mit deinem Lernraum und gib ihm einen Lernzettel – die Seite erscheint hier und ist sofort online.
          </span>
          <Link href="/einstellungen#claude" className="btn btn-accent">
            Claude verbinden
          </Link>
        </div>
      )}

      {[...groups.entries()].map(([day, list]) => (
        <section key={day} className={styles.group}>
          <span className={`label ${styles.groupLabel}`}>{day}</span>
          <div className={styles.list}>
            {list.map((item) => {
              const isQuiz = item.kind === 'quiz'
              const title = isQuiz && item.questionCount ? `${item.title} – ${item.questionCount} Fragen` : item.title
              const parentPath = item.path.split(' › ').slice(0, -1).join(' › ')
              const sub = isQuiz ? `an ${item.pageTitle ?? ''} · ${parentPath}` : item.path
              return (
                <Link key={item.id} href={item.url} className={`${styles.row} ${item.seen ? '' : styles.unseen}`}>
                  <span className={`${styles.type} ${isQuiz ? styles.quiz : ''}`}>{isQuiz ? 'Quiz' : 'Lernseite'}</span>
                  <span className={styles.name}>
                    <span className={`serif ${styles.nameMain}`}>
                      {title}
                      {!item.seen && <span className={styles.new}>NEU</span>}
                      {item.action === 'updated' && <span className={styles.tag}>aktualisiert</span>}
                    </span>
                    <span className={styles.nameSub}>{sub}</span>
                  </span>
                  <span className={styles.time}>{formatAge(item.createdAt, now)}</span>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
