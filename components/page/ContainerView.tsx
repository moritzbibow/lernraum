import type { ContainerView as ContainerData } from '@/lib/services/views'
import { ChildList } from './ChildList'
import Link from 'next/link'
import { SubjectActions } from './SubjectActions'
import styles from './Page.module.css'

export function ContainerView({ data }: { data: ContainerData }) {
  const s = data.subject
  const vars = s ? { ['--sh' as string]: s.hue, ['--sl' as string]: s.lightness, ['--sc' as string]: s.chroma } : undefined
  const title = s ? s.name : 'Allgemeine Seiten'
  const empty = data.sections.length === 0 && data.loose.length === 0
  return (
    <div className={styles.page}>
      <div className={styles.bar}>
        <nav className={styles.crumbs} aria-label="Pfad">
          <Link href="/bibliothek">Bibliothek</Link>
          <span className={styles.crumbSep}>/</span>
          <span className={styles.crumbCurrent}>{title}</span>
        </nav>
        <SubjectActions subject={s ? { id: s.id, name: s.name } : null} />
      </div>
      <div className={styles.folder} data-subject={s ? '' : undefined} style={vars}>
        <header className={styles.folderHead}>
          <span className={`label ${styles.containerKicker}`}>
            {s ? <span className="dot" /> : <span className="dot-general" />}
            {s ? 'Fach' : 'Ohne Fach'}
          </span>
          <h1 className={`serif ${styles.h1}`}>{title}</h1>
          <div className={styles.meta}>
            <span>{data.pageCount === 1 ? '1 Lernseite' : `${data.pageCount} Lernseiten`}</span>
            <span>{data.quizCount === 1 ? '1 Quiz' : `${data.quizCount} Quizze`}</span>
          </div>
        </header>

        {empty && (
          <p className={styles.empty}>
            {s
              ? `Noch keine Seiten in „${s.name}“. Gib Claude einen Lernzettel für dieses Fach – er erscheint hier sofort.`
              : 'Hier landen Lernseiten ohne Fach, z. B. Lerntechniken oder fächerübergreifende Notizen.'}
          </p>
        )}

        {data.loose.length > 0 && <ChildList items={data.loose} />}

        {data.sections.map((section) => (
          <section key={section.page.id} className={styles.section}>
            <div className={styles.sectionHead}>
              <Link href={section.page.url} className={`serif ${styles.sectionTitle}`}>
                {section.page.title}
              </Link>
              <span className={styles.sectionMeta}>
                {section.children.length === 1 ? '1 Seite' : `${section.children.length} Seiten`}
              </span>
            </div>
            <ChildList items={section.children} />
          </section>
        ))}
      </div>
    </div>
  )
}
