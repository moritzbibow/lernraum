import Link from 'next/link'
import { renderMarkdown } from '@/lib/content/markdown'
import { formatDayMonth, percent } from '@/lib/format'
import type { PageView as PageViewData } from '@/lib/services/views'
import { ChildList } from './ChildList'
import { MermaidRenderer } from './MermaidRenderer'
import { PageActions } from './PageActions'
import { ReadingProvider } from './ReadingContext'
import { TopicToc } from './TopicToc'
import styles from './Page.module.css'

function QuizCards({ quizzes, variant }: { quizzes: PageViewData['quizzes']; variant: 'aside' | 'inline' }) {
  if (quizzes.length === 0) return null
  return (
    <div className={variant === 'aside' ? styles.quizStack : styles.quizInline}>
      {quizzes.map((q) => (
        <div key={q.id} className={styles.quizCard}>
          <span className="label">{quizzes.length > 1 ? q.title : 'Quiz zu dieser Seite'}</span>
          <span className={`serif ${styles.quizCardTitle}`}>{q.questionCount} Fragen</span>
          <span className={styles.quizCardMeta}>
            {q.lastAttempt ? `Zuletzt: ${q.lastAttempt.score} / ${q.lastAttempt.total}` : 'Noch nicht gespielt'}
          </span>
          <Link href={`/quiz/${q.id}`} className={styles.quizCardBtn}>
            Starten
          </Link>
        </div>
      ))}
    </div>
  )
}

export function Breadcrumbs({ crumbs }: { crumbs: PageViewData['crumbs'] }) {
  return (
    <nav className={styles.crumbs} aria-label="Pfad">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1
        return (
          <span key={c.id} className={`${styles.crumb} ${i < crumbs.length - 2 ? styles.crumbFar : ''}`}>
            {i > 0 && <span className={styles.crumbSep}>/</span>}
            {last ? (
              <span className={styles.crumbCurrent} title={c.title}>
                {c.label}
              </span>
            ) : (
              <Link href={c.url} title={c.title}>
                {c.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}

export function PageView({ page }: { page: PageViewData }) {
  const parentUrl = page.crumbs.length > 1 ? page.crumbs[page.crumbs.length - 2].url : '/'
  const bar = (
    <div className={styles.bar}>
      <Breadcrumbs crumbs={page.crumbs} />
      <PageActions
        pageId={page.id}
        title={page.title}
        parentUrl={parentUrl}
        quizzes={page.quizzes.map((q) => ({ id: q.id, title: q.title }))}
        childCount={page.children.length}
      />
    </div>
  )

  // Folder: a page without own content – list its children.
  if (page.isFolder) {
    return (
      <div className={styles.page}>
        {bar}
        <div className={styles.folder}>
          <header className={styles.folderHead}>
            <span className={`label ${styles.kicker}`}>{page.kicker || 'Ordner'}</span>
            <h1 className={`serif ${styles.h1}`}>{page.title}</h1>
            <div className={styles.meta}>
              <span>{page.children.length === 1 ? '1 Seite' : `${page.children.length} Seiten`}</span>
              <span>geändert {formatDayMonth(page.updatedAt)}</span>
            </div>
          </header>
          {page.children.length > 0 ? (
            <ChildList items={page.children} />
          ) : (
            <p className={styles.empty}>Dieser Ordner ist noch leer. Neue Seiten kommen über Claude – oder verschiebe welche hierher.</p>
          )}
          <QuizCards quizzes={page.quizzes} variant="inline" />
        </div>
      </div>
    )
  }

  const rendered = renderMarkdown(page.contentMd)
  const topics = rendered.topics
  const articleId = `article-${page.id}`
  const source = page.source === 'claude' ? 'eingespeist via Claude' : 'manuell angelegt'

  return (
    <div className={styles.page}>
      {bar}
      <ReadingProvider pageId={page.id} topics={topics} initialProgress={page.topicProgress} articleId={articleId}>
        <div className={styles.body}>
          <article className={styles.article}>
            <span className={`label ${styles.kicker}`}>{page.kicker}</span>
            <h1 className={`serif ${styles.h1}`}>{page.heading}</h1>
            <div className={styles.meta}>
              <span>{topics.length === 1 ? '1 Thema' : `${topics.length} Themen`}</span>
              <span>≈ {page.readingMinutes} Min. Lesezeit</span>
              <span>{source}</span>
              {page.readProgress > 0 && <span className={styles.metaProgress}>{percent(page.readProgress)} % gelesen</span>}
            </div>
            <div id={articleId} className={`prose ${styles.prose}`} dangerouslySetInnerHTML={{ __html: rendered.html }} />
            {page.children.length > 0 && (
              <section className={styles.subpages}>
                <h2 className={`serif ${styles.subpagesTitle}`}>Unterseiten</h2>
                <ChildList items={page.children} />
              </section>
            )}
            <QuizCards quizzes={page.quizzes} variant="inline" />
          </article>
          <aside className={styles.aside}>
            {topics.length > 0 && <span className={`label ${styles.asideLabel}`}>Themen</span>}
            <TopicToc topics={topics} />
            <QuizCards quizzes={page.quizzes} variant="aside" />
          </aside>
        </div>
      </ReadingProvider>
      {rendered.hasMermaid && <MermaidRenderer containerId={articleId} />}
    </div>
  )
}
