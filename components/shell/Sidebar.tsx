'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createSubjectAction } from '@/lib/actions/library'
import type { TreeNode } from '@/lib/services/tree'
import { useApp } from '../providers/AppProviders'
import { PromptDialog } from '../ui/dialogs'
import { useToast } from '../ui/Toast'
import styles from './Shell.module.css'
import { ThemeSwitch } from './ThemeToggle'

const STORAGE_KEY = 'lr_tree_open'

function isActive(pathname: string, url: string) {
  return pathname === url
}

function containsPath(node: TreeNode, pathname: string): boolean {
  return pathname === node.url || pathname.startsWith(`${node.url}/`) || node.children.some((c) => containsPath(c, pathname))
}

function subjectStyle(node: TreeNode) {
  return {
    ['--sh' as string]: node.color?.hue,
    ['--sl' as string]: node.color?.lightness,
    ['--sc' as string]: node.color?.chroma,
  }
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const toast = useToast()
  const { tree, openPalette, unseen } = useApp()
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [newSubject, setNewSubject] = useState(false)

  // Auto-expand the branch that contains the current page – on the overview
  // the branch of the page you were last reading.
  const { activeBranch, focusId } = useMemo(() => {
    const ids = new Set<string>()
    const all = [...tree.subjects, tree.general]
    const walk = (nodes: TreeNode[], match: (n: TreeNode) => boolean): boolean => {
      let found = false
      for (const n of nodes) {
        if (match(n)) {
          found = true
          if (n.children.length) ids.add(n.id)
          walk(n.children, match)
        }
      }
      return found
    }
    const onPage = walk(all, (n) => containsPath(n, pathname))
    let focus: string | null = null
    if (!onPage && pathname === '/' && tree.focusId) {
      focus = tree.focusId
      const containsFocus = (n: TreeNode): boolean => n.id === focus || n.children.some(containsFocus)
      const expand = (nodes: TreeNode[]) => {
        for (const n of nodes) {
          if (containsFocus(n) && n.children.length) {
            ids.add(n.id)
            expand(n.children)
          }
        }
      }
      expand(all)
    }
    return { activeBranch: ids, focusId: focus }
  }, [tree, pathname])

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[]
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(new Set(stored))
    } catch {
      // ignore
    }
  }, [])

  const toggle = (id: string) => {
    setOpen((prev) => {
      const next = new Set(prev)
      const isOpen = next.has(id) || (activeBranch.has(id) && !next.has(`-${id}`))
      if (isOpen) {
        next.delete(id)
        next.add(`-${id}`)
      } else {
        next.add(id)
        next.delete(`-${id}`)
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // ignore
      }
      return next
    })
  }
  const isOpen = (id: string) => open.has(id) || (activeBranch.has(id) && !open.has(`-${id}`))

  const chevron = (node: TreeNode) =>
    node.children.length > 0 ? (
      <button
        type="button"
        className={styles.chev}
        aria-label={isOpen(node.id) ? `${node.title} zuklappen` : `${node.title} aufklappen`}
        aria-expanded={isOpen(node.id)}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          toggle(node.id)
        }}
      >
        {isOpen(node.id) ? '▾' : '▸'}
      </button>
    ) : null

  const renderLeaves = (nodes: TreeNode[]) => (
    <div className={styles.leafCol}>
      {nodes.map((n) => {
        const active = isActive(pathname, n.url)
        return (
          <div key={n.id}>
            <div className={`${styles.row} ${styles.leaf} ${active ? styles.leafActive : n.id === focusId ? styles.leafCurrent : ''}`}>
              <Link href={n.url} className={styles.rowLink} title={n.title} aria-current={active ? 'page' : undefined}>
                <span className={styles.ellipsis}>{n.title}</span>
                {n.isNew && <span className={styles.new}>NEU</span>}
              </Link>
              {chevron(n)}
            </div>
            {n.children.length > 0 && isOpen(n.id) && <div className={styles.nested}>{renderLeaves(n.children)}</div>}
          </div>
        )
      })}
    </div>
  )

  const renderLevel1 = (nodes: TreeNode[]) =>
    nodes.map((n) => {
      const active = isActive(pathname, n.url)
      return (
        <div key={n.id}>
          <div className={`${styles.row} ${styles.level1} ${isOpen(n.id) ? styles.level1Open : ''} ${active ? styles.level1Active : ''}`}>
            <Link href={n.url} className={styles.rowLink} title={n.title} aria-current={active ? 'page' : undefined}>
              <span className={styles.ellipsis}>{n.title}</span>
              {n.isNew && <span className={styles.new}>NEU</span>}
            </Link>
            {chevron(n)}
          </div>
          {n.children.length > 0 && isOpen(n.id) && renderLeaves(n.children)}
        </div>
      )
    })

  const navItems = [
    { href: '/', label: 'Übersicht' },
    { href: '/eingang', label: 'Eingang', badge: unseen },
    { href: '/quizze', label: 'Alle Quizze' },
    { href: '/verwalten', label: 'Verwalten' },
  ]

  return (
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.logo} aria-label="Lernraum – Übersicht">
        <span className={styles.logoDot} />
        <span className={`serif ${styles.logoText}`}>Lernraum</span>
      </Link>

      {pathname !== '/' && (
        <button type="button" className={styles.search} onClick={() => openPalette()}>
          <span className={styles.searchIcon} aria-hidden />
          Suchen
          <span className={styles.searchKbd}>⌘K</span>
        </button>
      )}

      <nav className={styles.nav} aria-label="Hauptnavigation">
        {navItems.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} className={`${styles.navItem} ${active ? styles.navActive : ''}`}>
              {item.label}
              {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
            </Link>
          )
        })}
      </nav>

      <div className={styles.library}>
        <div className={styles.libHead}>
          <span>BIBLIOTHEK</span>
          <button type="button" className={styles.libAdd} aria-label="Neues Fach" title="Neues Fach" onClick={() => setNewSubject(true)}>
            +
          </button>
        </div>
        <div className={styles.treeScroll}>
          {tree.subjects.map((s) => (
            <div key={s.id}>
              <div
                className={`${styles.row} ${styles.subject} ${isOpen(s.id) || isActive(pathname, s.url) ? styles.subjectOpen : ''}`}
                data-subject=""
                style={subjectStyle(s)}
              >
                <Link
                  href={s.url}
                  className={styles.rowLink}
                  title={s.title}
                  onClick={() => {
                    if (!isOpen(s.id) && s.children.length) toggle(s.id)
                  }}
                >
                  <span className="dot" />
                  <span className={styles.ellipsis}>{s.title}</span>
                </Link>
                {chevron(s)}
              </div>
              {isOpen(s.id) && renderLevel1(s.children)}
            </div>
          ))}
          {tree.subjects.length === 0 && <p className={styles.treeEmpty}>Noch keine Fächer. Claude legt sie beim Einspeisen an – oder hier mit +.</p>}

          <div>
            <div className={`${styles.row} ${styles.general} ${isActive(pathname, tree.general.url) ? styles.generalActive : ''}`}>
              <Link href={tree.general.url} className={styles.rowLink}>
                <span className="dot-general" />
                <span className={styles.ellipsis}>Allgemeine Seiten</span>
                {tree.general.isNew && <span className={styles.new}>NEU</span>}
              </Link>
              {chevron(tree.general)}
            </div>
            {isOpen(tree.general.id) && tree.general.children.length > 0 && renderLeaves(tree.general.children)}
          </div>
        </div>
      </div>

      <div className={styles.themeRow}>
        <span>Dunkler Modus</span>
        <ThemeSwitch />
      </div>

      <PromptDialog
        open={newSubject}
        onClose={() => setNewSubject(false)}
        kicker="BIBLIOTHEK"
        title="Neues Fach"
        label="Name"
        placeholder="z. B. Biologie"
        submitLabel="Anlegen"
        onSubmit={async (name) => {
          const res = await createSubjectAction(name)
          if (!res.ok) return res.error
          toast({ message: `Fach „${name}“ angelegt` })
          router.push(`/f/${res.subject.slug}`)
        }}
      />
    </aside>
  )
}
