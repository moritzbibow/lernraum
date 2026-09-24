'use client'

import { useMemo, useState } from 'react'
import type { LibraryTree, TreeNode } from '@/lib/services/tree'
import { normalizeForMatch } from '@/lib/text'
import { Modal } from './Modal'
import styles from './TreePicker.module.css'

export type PickTarget = { subjectId: string | null; parentId: string | null; label: string }

type Row = {
  key: string
  node: TreeNode
  depth: number
  subjectId: string | null
  disabled: boolean
}

function flatten(tree: LibraryTree, exclude: Set<string>, mode: 'container' | 'page'): Row[] {
  const rows: Row[] = []
  const walk = (nodes: TreeNode[], depth: number, subjectId: string | null, blocked: boolean) => {
    for (const n of nodes) {
      const isBlocked = blocked || exclude.has(n.id)
      rows.push({ key: n.id, node: n, depth, subjectId, disabled: isBlocked })
      walk(n.children, depth + 1, subjectId, isBlocked)
    }
  }
  for (const s of tree.subjects) {
    rows.push({ key: s.id, node: s, depth: 0, subjectId: s.id, disabled: mode === 'page' })
    walk(s.children, 1, s.id, false)
  }
  rows.push({ key: 'general', node: tree.general, depth: 0, subjectId: null, disabled: mode === 'page' })
  walk(tree.general.children, 1, null, false)
  return rows
}

type Props = {
  open: boolean
  onClose: () => void
  tree: LibraryTree
  title?: string
  /** Items (and their subtrees) that cannot be targets – e.g. the pages being moved. */
  exclude?: string[]
  /** container: subject/general/page as new parent. page: only pages (moving a quiz). */
  mode?: 'container' | 'page'
  confirmLabel?: string
  onPick: (target: PickTarget & { pageId: string | null }) => Promise<void> | void
}

/** "Verschieben nach…" – pick a subject, "Allgemeine Seiten" or a page as destination. */
export function TreePicker({ open, onClose, tree, title = 'Verschieben nach…', exclude = [], mode = 'container', confirmLabel = 'Hierher verschieben', onPick }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const rows = useMemo(() => flatten(tree, new Set(exclude), mode), [tree, exclude, mode])
  const q = normalizeForMatch(query)
  const visible = q ? rows.filter((r) => normalizeForMatch(r.node.title).includes(q)) : rows
  const selectedRow = rows.find((r) => r.key === selected) ?? null

  const confirm = async () => {
    if (!selectedRow || selectedRow.disabled) return
    const n = selectedRow.node
    setBusy(true)
    try {
      await onPick({
        subjectId: selectedRow.subjectId,
        parentId: n.kind === 'page' ? n.id : null,
        pageId: n.kind === 'page' ? n.id : null,
        label: n.title,
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      kicker="BIBLIOTHEK"
      width={520}
      footer={
        <>
          <span className={styles.target}>{selectedRow ? `Ziel: ${selectedRow.node.title}` : 'Ziel wählen'}</span>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-accent" disabled={!selectedRow || selectedRow.disabled || busy} onClick={confirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <input className="input" placeholder="Filtern …" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className={styles.list} role="listbox" aria-label="Ziel">
        {visible.map((r) => {
          const n = r.node
          const color = n.color
          return (
            <button
              key={r.key}
              type="button"
              role="option"
              aria-selected={selected === r.key}
              disabled={r.disabled}
              className={`${styles.row} ${selected === r.key ? styles.selected : ''} ${n.kind !== 'page' ? styles.root : ''}`}
              style={{ paddingLeft: 12 + (q ? 0 : r.depth) * 18 }}
              onClick={() => setSelected(r.key)}
              onDoubleClick={() => {
                setSelected(r.key)
                void confirm()
              }}
            >
              {n.kind === 'subject' && (
                <span
                  className="dot"
                  data-subject=""
                  style={{ ['--sh' as string]: color?.hue, ['--sl' as string]: color?.lightness, ['--sc' as string]: color?.chroma }}
                />
              )}
              {n.kind === 'general' && <span className="dot-general" />}
              <span className={styles.name}>{n.title}</span>
              {n.kind === 'page' && n.isFolder && n.children.length > 0 && <span className={styles.meta}>Ordner</span>}
            </button>
          )
        })}
        {visible.length === 0 && <p className={styles.empty}>Nichts gefunden.</p>}
      </div>
    </Modal>
  )
}
