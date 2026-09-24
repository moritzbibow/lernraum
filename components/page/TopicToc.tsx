'use client'

import type { Topic } from '@/lib/db/schema'
import { useReading } from './ReadingContext'
import styles from './Page.module.css'

export function TopicToc({ topics }: { topics: Topic[] }) {
  const { activeTopic, progress, jumpTo } = useReading()
  if (topics.length === 0) return null
  return (
    <nav className={styles.toc} aria-label="Themen">
      {topics.map((t) => {
        const done = (progress[t.id] ?? 0) >= 0.8
        return (
          <a
            key={t.id}
            href={`#t-${t.id}`}
            className={`${styles.tocItem} ${activeTopic === t.id ? styles.tocActive : ''}`}
            aria-current={activeTopic === t.id ? 'location' : undefined}
            onClick={(e) => {
              e.preventDefault()
              jumpTo(t.id)
            }}
          >
            <span>{t.title}</span>
            {done && <span className={styles.tocDone}>✓</span>}
          </a>
        )
      })}
    </nav>
  )
}
