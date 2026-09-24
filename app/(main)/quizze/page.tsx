import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '@/components/lists/Lists.module.css'
import { QuizRowActions } from '@/components/lists/QuizRowActions'
import { formatChanged, percent, serverNow } from '@/lib/format'
import { listQuizzes } from '@/lib/services/quizzes'

export const metadata: Metadata = { title: 'Alle Quizze' }

export default function QuizzesPage() {
  const groups = listQuizzes()
  const count = groups.reduce((n, g) => n + g.quizzes.length, 0)
  const questions = groups.reduce((n, g) => n + g.quizzes.reduce((m, q) => m + q.questionCount, 0), 0)
  const now = serverNow()

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <span className={`label ${styles.kicker}`}>Üben</span>
          <h1 className={`serif ${styles.title}`}>Alle Quizze</h1>
          <p className={styles.sub}>
            {count === 1 ? '1 Quiz' : `${count} Quizze`} · {questions} Fragen · erstellt von Claude, bearbeitbar hier
          </p>
        </div>
      </header>

      {count === 0 && (
        <div className={styles.empty}>
          <span className={`serif ${styles.emptyTitle}`}>Noch keine Quizze.</span>
          <span>Quizze entstehen nicht hier, sondern kommen von Claude – zusammen mit einer Lernseite oder nachträglich.</span>
        </div>
      )}

      {groups.map((g) => {
        const vars = g.subject
          ? { ['--sh' as string]: g.subject.hue, ['--sl' as string]: g.subject.lightness, ['--sc' as string]: g.subject.chroma }
          : undefined
        return (
          <section key={g.subject?.id ?? 'general'} className={styles.group} data-subject={g.subject ? '' : undefined} style={vars}>
            <span className={`label ${styles.groupLabel} ${g.subject ? styles.groupLabelSubject : ''}`}>
              {g.subject ? <span className="dot" /> : <span className="dot-general" />}
              {g.subject?.name ?? 'Allgemein'}
            </span>
            <div className={styles.list}>
              {g.quizzes.map((q) => {
                const last = q.lastAttempt
                return (
                  <div key={q.id} className={`${styles.row} ${styles.rowHover}`}>
                    <Link href={`/quiz/${q.id}`} className={styles.name}>
                      <span className={`serif ${styles.nameMain}`}>{q.title}</span>
                      <span className={styles.nameSub}>
                        {q.questionCount} Fragen · {q.path} · geändert {formatChanged(q.updatedAt, now)}
                      </span>
                    </Link>
                    <div className={`${styles.score} ${styles.hideMobile}`}>
                      {last ? (
                        <>
                          <span className={styles.scoreText}>
                            {last.score} / {last.total}
                          </span>
                          <span className={styles.scoreBar}>
                            <span style={{ width: `${percent(last.score / Math.max(1, last.total))}%` }} />
                          </span>
                        </>
                      ) : (
                        <span className={styles.scoreNone}>nicht gespielt</span>
                      )}
                    </div>
                    <QuizRowActions quiz={{ id: q.id, title: q.title, pageId: q.pageId }} />
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
