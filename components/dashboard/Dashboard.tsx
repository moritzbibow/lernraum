import Link from 'next/link'
import { formatAge, formatLongDate, formatShortDate, greeting, percent } from '@/lib/format'
import type { InboxEntry } from '@/lib/services/inbox'
import type { ContinueCard, Dashboard as DashboardData, RecentCard, SubjectInfo } from '@/lib/services/views'
import { splitTitle } from '@/lib/text'
import styles from './Dashboard.module.css'
import { SearchHero } from './SearchHero'

function subjectVars(subject: SubjectInfo | null) {
  if (!subject) return undefined
  return { ['--sh' as string]: subject.hue, ['--sl' as string]: subject.lightness, ['--sc' as string]: subject.chroma }
}

const NBSP = ' '

type Props = { data: DashboardData; now: number; name: string; initials: string }

export function Dashboard({ data, now, name, initials }: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.mobileTop}>
          <span className={styles.mobileBrand}>
            <span className={styles.mobileDot} />
            <span className={`label ${styles.date}`}>{formatShortDate(now)}</span>
          </span>
          <Link href="/einstellungen" className={styles.avatar} aria-label="Einstellungen">
            {initials}
          </Link>
        </div>
        <div>
          <div className={`label ${styles.date} ${styles.dateLong}`}>{formatLongDate(now)}</div>
          <h1 className={`serif ${styles.greeting}`}>
            {greeting(now)}, {name}.
          </h1>
        </div>
        <Link href="/einstellungen" className={`${styles.avatar} ${styles.avatarDesktop}`} aria-label="Einstellungen" title="Einstellungen">
          {initials}
        </Link>
      </header>

      <div className={styles.searchBlock}>
        <SearchHero />
        {data.chips.length > 0 && (
          <div className={styles.chips}>
            {data.chips.map((c) => (
              <Link key={c.url} href={c.url} className={styles.chip}>
                {c.title}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className={styles.bento}>
        <ContinueTile card={data.continueCard} />
        <FreshTile items={data.fresh} unseen={data.unseen} now={now} />
        {[0, 1].map((i) => (
          <RecentTile key={i} card={data.recent[i]} />
        ))}
      </div>
    </div>
  )
}

function ContinueTile({ card }: { card: ContinueCard | null }) {
  if (!card) {
    return (
      <section className={`${styles.tile} ${styles.continue}`}>
        <div className={styles.continueTop}>
          <span className="label">Los geht’s</span>
        </div>
        <h2 className={`serif hyphenate ${styles.continueTitle}`}>Dein erster Lernzettel</h2>
        <p className={styles.continueSub}>
          Gib Claude einen Lernzettel – er wird eingespeist und ist sofort hier online.
        </p>
        <div className={styles.continueActions}>
          <Link href="/einstellungen" className="pill-dark">
            Claude verbinden
          </Link>
        </div>
      </section>
    )
  }
  const pct = percent(card.progress)
  const { short } = splitTitle(card.title)
  return (
    <section className={`${styles.tile} ${styles.continue}`}>
      <div className={styles.continueTop}>
        <span className="label">Weiterlernen · {card.subject?.name ?? 'Allgemein'}</span>
        <span className={styles.pct}>
          {pct}
          {NBSP}%
        </span>
      </div>
      <Link href={card.url} className={`serif hyphenate ${styles.continueTitle}`}>
        {card.mainTitle}
      </Link>
      <div className={`${styles.continueSub} ${styles.subDesktop}`}>{card.pathLabel}</div>
      <div className={`${styles.continueSub} ${styles.subMobile}`}>
        {card.pathLabel || short} · {pct}
        {NBSP}%
      </div>
      {card.topics.length > 0 && (
        <div className={styles.topics}>
          {card.topics.map((t) => (
            <div key={t.title} className={styles.topicRow}>
              <span>{t.title}</span>
              <span className={styles.topicMark}>{t.done ? '✓' : '—'}</span>
            </div>
          ))}
        </div>
      )}
      <div className={styles.continueActions}>
        <Link href={card.url} className="pill-dark">
          Öffnen
        </Link>
        {card.quiz && (
          <Link href={card.quiz.url} className="pill-outline-dark">
            <span className={styles.quizLong}>Quiz · {card.quiz.questionCount}</span>
            <span className={styles.quizShort}>Quiz</span>
          </Link>
        )}
      </div>
    </section>
  )
}

function FreshTile({ items, unseen, now }: { items: InboxEntry[]; unseen: number; now: number }) {
  return (
    <section className={`${styles.tile} ${styles.card} ${styles.fresh}`}>
      <div className={styles.freshHead}>
        <Link href="/eingang" className={styles.freshTitle}>
          Frisch eingespeist
        </Link>
        <span className={`label ${styles.freshMeta}`}>via Claude · sofort online</span>
        {unseen > 0 && <span className={`label ${styles.freshNew}`}>{unseen} neu</span>}
      </div>
      {items.length === 0 && (
        <p className={styles.freshEmpty}>Noch nichts eingespeist. Sobald Claude einen Lernzettel schickt, erscheint er hier.</p>
      )}
      {items.map((item) => {
        const type = item.kind === 'page' ? 'Lernseite' : 'Quiz'
        const title = item.kind === 'quiz' && item.questionCount ? `${item.title} – ${item.questionCount} Fragen` : item.title
        const path = item.kind === 'quiz' ? `an ${splitTitle(item.pageTitle ?? '').short}` : item.path
        return (
          <Link key={item.id} href={item.url} className={styles.freshRow}>
            <span className={`${styles.freshType} ${item.kind === 'quiz' ? styles.typeQuiz : ''}`}>{type}</span>
            <span className={`${styles.freshMobileType} ${item.kind === 'quiz' ? styles.typeQuiz : ''}`}>
              {type} · {formatAge(item.createdAt, now)}
            </span>
            <span className={`serif ${styles.freshName}`}>
              {title}
            </span>
            <span className={styles.freshPath}>{path}</span>
            <span className={styles.freshTime}>{formatAge(item.createdAt, now)}</span>
          </Link>
        )
      })}
    </section>
  )
}

function RecentTile({ card }: { card: RecentCard | undefined }) {
  if (!card) {
    return (
      <section className={`${styles.tile} ${styles.card} ${styles.recent} ${styles.recentEmpty}`}>
        <span className={`label ${styles.recentLabel}`}>Zuletzt geöffnet</span>
        <div className={`serif ${styles.recentTitle}`}>Hier erscheint, was du zuletzt gelernt hast.</div>
      </section>
    )
  }
  const pct = percent(card.progress)
  return (
    <Link href={card.url} className={`${styles.tile} ${styles.card} ${styles.recent}`} data-subject="" style={subjectVars(card.subject)}>
      <div className={styles.recentTop}>
        <span className={`label ${styles.recentLabel}`}>{card.label}</span>
        <span className={styles.recentPct}>
          {pct}
          {NBSP}%
        </span>
      </div>
      <div className={`serif ${styles.recentTitle}`}>{card.title}</div>
      <div className={styles.progress}>
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>
    </Link>
  )
}
