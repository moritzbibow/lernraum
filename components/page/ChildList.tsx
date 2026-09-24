import Link from 'next/link'
import { percent } from '@/lib/format'
import type { ChildCard } from '@/lib/services/views'
import styles from './Page.module.css'

export function ChildList({ items }: { items: ChildCard[] }) {
  return (
    <div className={styles.children}>
      {items.map((c) => {
        const info: string[] = []
        if (c.isFolder) info.push(c.childCount === 1 ? '1 Seite' : `${c.childCount} Seiten`)
        else info.push(c.topicCount === 1 ? '1 Thema' : `${c.topicCount} Themen`)
        if (c.quizQuestions) info.push(`Quiz · ${c.quizQuestions} Fragen`)
        const pct = percent(c.readProgress)
        return (
          <Link key={c.id} href={c.url} className={styles.child}>
            <span className={`serif ${styles.childTitle}`}>{c.title}</span>
            <span className={styles.childMeta}>{info.join(' · ')}</span>
            <span className={styles.childRight}>
              {c.isFolder ? (
                <span className={`label ${styles.childFolder}`}>Ordner</span>
              ) : (
                <>
                  <span className={styles.childPct}>{pct} %</span>
                  <span className={styles.childBar}>
                    <span style={{ width: `${pct}%` }} />
                  </span>
                </>
              )}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
