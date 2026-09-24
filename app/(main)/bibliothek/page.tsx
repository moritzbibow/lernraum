import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '@/components/lists/Lists.module.css'
import { LibrarySearch } from '@/components/library/LibrarySearch'
import type { TreeNode } from '@/lib/services/tree'
import { buildTree } from '@/lib/services/tree'

export const metadata: Metadata = { title: 'Bibliothek' }

function countPages(n: TreeNode): number {
  return n.children.reduce((sum, c) => sum + (c.isFolder ? 0 : 1) + countPages(c), 0)
}

function Card({ node }: { node: TreeNode }) {
  const vars = node.color
    ? { ['--sh' as string]: node.color.hue, ['--sl' as string]: node.color.lightness, ['--sc' as string]: node.color.chroma }
    : undefined
  const pages = countPages(node)
  return (
    <section className={styles.card} data-subject={node.color ? '' : undefined} style={vars}>
      <div className={styles.cardHead}>
        <span className={`label ${styles.cardLabel}`}>
          {node.kind === 'subject' ? <span className="dot" /> : <span className="dot-general" />}
          {node.kind === 'subject' ? 'Fach' : 'Ohne Fach'}
        </span>
        <Link href={node.url} className={`serif ${styles.cardTitle}`}>
          {node.title}
        </Link>
        <span className={styles.cardMeta}>
          {pages === 1 ? '1 Lernseite' : `${pages} Lernseiten`}
          {node.subtreeQuizCount ? ` · ${node.subtreeQuizCount === 1 ? '1 Quiz' : `${node.subtreeQuizCount} Quizze`}` : ''}
        </span>
      </div>
      {node.children.length > 0 && (
        <div className={styles.cardList}>
          {node.children.slice(0, 8).map((c) => (
            <Link key={c.id} href={c.url} className={styles.cardItem}>
              <span>
                {c.title}
                {c.isNew && <span className={styles.new}>NEU</span>}
              </span>
              <span className={styles.cardItemMeta}>
                {c.children.length ? `${c.children.length} Seiten` : c.quizCount ? `Quiz · ${c.questionCount}` : ''}
              </span>
            </Link>
          ))}
          {node.children.length > 8 && (
            <Link href={node.url} className={styles.cardItem}>
              <span className={styles.cardItemMeta}>+ {node.children.length - 8} weitere</span>
            </Link>
          )}
        </div>
      )}
    </section>
  )
}

export default function LibraryPage() {
  const tree = buildTree()
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <span className={`label ${styles.kicker}`}>Alles an einem Ort</span>
          <h1 className={`serif ${styles.title}`}>Bibliothek</h1>
        </div>
        <div className={styles.headActions}>
          <Link href="/verwalten" className="btn btn-outline">
            Verwalten
          </Link>
        </div>
      </header>
      <LibrarySearch />
      <nav className={styles.quickLinks} aria-label="Bereiche">
        <Link href="/quizze">Alle Quizze</Link>
        <Link href="/verwalten">Verwalten</Link>
        <Link href="/einstellungen">Einstellungen</Link>
      </nav>
      <div className={styles.cards}>
        {tree.subjects.map((s) => (
          <Card key={s.id} node={s} />
        ))}
        <Card node={tree.general} />
      </div>
    </div>
  )
}
