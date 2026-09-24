'use client'

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createFolderAction,
  createSubjectAction,
  deleteAction,
  moveAction,
  moveSubjectAction,
  renameAction,
  restoreAction,
} from '@/lib/actions/library'
import { formatChanged } from '@/lib/format'
import type { LibraryTree, TreeNode } from '@/lib/services/tree'
import { useApp } from '../providers/AppProviders'
import { ConfirmDialog, PromptDialog } from '../ui/dialogs'
import { useToast } from '../ui/Toast'
import { TreePicker } from '../ui/TreePicker'
import styles from './ManageView.module.css'

type Row = {
  key: string
  node: TreeNode
  depth: number
  subjectId: string | null
  parentId: string | null
}

type Intent = { overKey: string; position: 'before' | 'after' | 'inside'; valid: boolean }

const STORAGE_KEY = 'lr_manage_open'

function indexTree(tree: LibraryTree) {
  const parentOf = new Map<string, string | null>()
  const subjectOf = new Map<string, string | null>()
  const nodeOf = new Map<string, TreeNode>()
  const walk = (nodes: TreeNode[], parent: string | null, subject: string | null) => {
    for (const n of nodes) {
      nodeOf.set(n.id, n)
      parentOf.set(n.id, parent)
      subjectOf.set(n.id, subject)
      walk(n.children, n.id, subject)
    }
  }
  for (const s of tree.subjects) {
    nodeOf.set(s.id, s)
    walk(s.children, null, s.id)
  }
  nodeOf.set('general', tree.general)
  walk(tree.general.children, null, null)
  return { parentOf, subjectOf, nodeOf }
}

function typeLabel(n: TreeNode) {
  if (n.kind === 'subject') return 'Fach'
  if (n.kind === 'general') return 'Sammlung'
  return n.isFolder ? 'Ordner' : 'Lernseite'
}

function quizLabel(n: TreeNode) {
  if (n.kind === 'subject' || n.kind === 'general') return n.subtreeQuizCount ? String(n.subtreeQuizCount) : '—'
  if (n.quizCount) return `${n.questionCount} Fragen`
  return '—'
}

export function ManageView({ now: serverNow }: { now: number }) {
  const router = useRouter()
  const toast = useToast()
  const { tree } = useApp()
  const index = useMemo(() => indexTree(tree), [tree])
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragKeys, setDragKeys] = useState<string[] | null>(null)
  const [intent, setIntent] = useState<Intent | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'subject' | 'folder' | 'move' | 'rename' | 'delete' | null>(null)
  const [folderParent, setFolderParent] = useState<string>('')
  const [now, setNow] = useState(serverNow)
  const hoverTimer = useRef<number | undefined>(undefined)

  // Initial expansion: stored state, else branches with new items / the page last read.
  useEffect(() => {
    let initial: string[] | null = null
    try {
      initial = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    } catch {
      initial = null
    }
    const ids = new Set<string>(initial ?? [])
    if (!initial) {
      const expandTo = (id: string | null) => {
        let p = id ? index.parentOf.get(id) : null
        while (p) {
          ids.add(p)
          p = index.parentOf.get(p) ?? null
        }
        const s = id ? index.subjectOf.get(id) : null
        if (s) ids.add(s)
        else if (id) ids.add('general')
      }
      index.nodeOf.forEach((n, id) => {
        if (n.kind === 'page' && n.isNew) expandTo(id)
      })
      expandTo(tree.focusId)
      if (ids.size === 0 && tree.subjects[0]) ids.add(tree.subjects[0].id)
    }
    // Deep link from "In Verwalten zeigen": /verwalten#<id>
    const hash = decodeURIComponent(window.location.hash.slice(1))
    if (hash && index.nodeOf.has(hash)) {
      let p = index.parentOf.get(hash) ?? null
      while (p) {
        ids.add(p)
        p = index.parentOf.get(p) ?? null
      }
      const s = index.subjectOf.get(hash)
      if (s) ids.add(s)
      else if (hash !== 'general') ids.add('general')
      window.setTimeout(() => {
        setFlash(hash)
        document.getElementById(`row-${hash}`)?.scrollIntoView({ block: 'center' })
      }, 60)
      window.setTimeout(() => setFlash(null), 2200)
    }
    // One-time restore from localStorage after hydration (not available during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(ids)
    const t = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(t)
    // Runs once on mount on purpose: later tree updates must not reset the user's expansion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setOpenPersist = (next: Set<string>) => {
    setOpen(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
    } catch {
      // ignore
    }
  }
  const toggleOpen = (id: string) => {
    const next = new Set(open)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOpenPersist(next)
  }

  // Visible rows
  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    const walk = (nodes: TreeNode[], depth: number, subjectId: string | null, parentId: string | null) => {
      for (const n of nodes) {
        out.push({ key: n.id, node: n, depth, subjectId, parentId })
        if (open.has(n.id)) walk(n.children, depth + 1, subjectId, n.id)
      }
    }
    for (const s of tree.subjects) {
      out.push({ key: s.id, node: s, depth: 0, subjectId: s.id, parentId: null })
      if (open.has(s.id)) walk(s.children, 1, s.id, null)
    }
    out.push({ key: 'general', node: tree.general, depth: 0, subjectId: null, parentId: null })
    if (open.has('general')) walk(tree.general.children, 1, null, null)
    return out
  }, [tree, open])
  const rowByKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows])

  // Keep the selection valid after data changes.
  const validSelected = [...selected].filter((k) => index.nodeOf.has(k))
  const selectedPages = validSelected.filter((k) => index.nodeOf.get(k)?.kind === 'page')
  const selectedSubjects = validSelected.filter((k) => index.nodeOf.get(k)?.kind === 'subject')

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const isInside = (key: string, ancestor: string) => {
    let p: string | null | undefined = key
    while (p) {
      if (p === ancestor) return true
      p = index.parentOf.get(p) ?? null
    }
    return false
  }

  // ---------------------------------------------------------------- DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  )

  const onDragStart = (e: DragStartEvent) => {
    const key = String(e.active.id)
    const node = index.nodeOf.get(key)
    if (!node) return
    if (selected.has(key) && validSelected.length > 1) {
      // Drag the whole selection (only items of the same kind).
      setDragKeys(validSelected.filter((k) => index.nodeOf.get(k)?.kind === node.kind))
    } else {
      setDragKeys([key])
    }
  }

  const computeIntent = (e: DragMoveEvent): Intent | null => {
    if (!e.over || !dragKeys) return null
    const overKey = String(e.over.id)
    const over = rowByKey.get(overKey)
    if (!over) return null
    const act = e.activatorEvent as PointerEvent | TouchEvent
    const startY = 'touches' in act ? (act.touches[0]?.clientY ?? 0) : act.clientY
    const y = startY + e.delta.y
    const rect = e.over.rect
    const rel = (y - rect.top) / Math.max(1, rect.height)
    const draggingSubject = index.nodeOf.get(dragKeys[0])?.kind === 'subject'

    if (draggingSubject) {
      const valid = over.node.kind === 'subject' && !dragKeys.includes(overKey)
      return { overKey, position: rel < 0.5 ? 'before' : 'after', valid }
    }
    const blocked = dragKeys.some((k) => isInside(overKey, k))
    if (over.node.kind !== 'page') return { overKey, position: 'inside', valid: !blocked }
    const position = rel < 0.25 ? 'before' : rel > 0.75 ? 'after' : 'inside'
    return { overKey, position, valid: !blocked }
  }

  const onDragMove = (e: DragMoveEvent) => {
    const next = computeIntent(e)
    setIntent((prev) =>
      prev?.overKey === next?.overKey && prev?.position === next?.position && prev?.valid === next?.valid ? prev : next,
    )
    // Hovering a collapsed row expands it after a moment.
    window.clearTimeout(hoverTimer.current)
    if (next?.position === 'inside' && next.valid && !open.has(next.overKey) && index.nodeOf.get(next.overKey)?.children.length) {
      const key = next.overKey
      hoverTimer.current = window.setTimeout(() => setOpenPersist(new Set([...open, key])), 700)
    }
  }

  const resetDrag = () => {
    window.clearTimeout(hoverTimer.current)
    setDragKeys(null)
    setIntent(null)
  }

  const onDragEnd = async (e: DragEndEvent) => {
    const keys = dragKeys
    const finalIntent = computeIntent(e as DragMoveEvent) ?? intent
    resetDrag()
    if (!keys || !finalIntent || !finalIntent.valid) return
    const over = rowByKey.get(finalIntent.overKey)
    if (!over) return
    const first = index.nodeOf.get(keys[0])!

    if (first.kind === 'subject') {
      const res = await moveSubjectAction(keys[0], finalIntent.position === 'before' ? { beforeId: over.key } : { afterId: over.key })
      if (!res.ok) toast({ message: res.error, tone: 'error' })
      return
    }

    let target: { subjectId: string | null; parentId: string | null; beforeId?: string; afterId?: string; label: string }
    if (over.node.kind === 'subject') target = { subjectId: over.key, parentId: null, label: over.node.title }
    else if (over.node.kind === 'general') target = { subjectId: null, parentId: null, label: 'Allgemeine Seiten' }
    else if (finalIntent.position === 'inside') target = { subjectId: over.subjectId, parentId: over.key, label: over.node.title }
    else {
      const parentTitle = over.parentId ? index.nodeOf.get(over.parentId)?.title : over.subjectId ? index.nodeOf.get(over.subjectId)?.title : 'Allgemeine Seiten'
      target = {
        subjectId: over.subjectId,
        parentId: over.parentId,
        ...(finalIntent.position === 'before' ? { beforeId: over.key } : { afterId: over.key }),
        label: parentTitle ?? '',
      }
    }
    const res = await moveAction(keys, target)
    if (!res.ok) {
      toast({ message: res.error, tone: 'error' })
      return
    }
    if (finalIntent.position === 'inside' && over.node.kind === 'page') setOpenPersist(new Set([...open, over.key]))
    toast({ message: keys.length > 1 ? `${keys.length} Einträge nach „${target.label}“ verschoben` : `Nach „${target.label}“ verschoben` })
  }

  // ---------------------------------------------------------- actions
  const onlySelected = validSelected.length === 1 ? index.nodeOf.get(validSelected[0]) : undefined

  const doDelete = async () => {
    const refs = validSelected
      .map((k) => index.nodeOf.get(k)!)
      .filter((n) => n.kind === 'page' || n.kind === 'subject')
      .map((n) => ({ kind: n.kind as 'page' | 'subject', id: n.id }))
    const res = await deleteAction(refs)
    if (!res.ok) {
      toast({ message: res.error, tone: 'error' })
      return
    }
    setSelected(new Set())
    toast({
      message: refs.length > 1 ? `${refs.length} Einträge gelöscht` : `„${index.nodeOf.get(refs[0].id)?.title}“ gelöscht`,
      action: { label: 'Rückgängig', onClick: async () => void (await restoreAction(res.batch)) },
    })
  }

  const containerOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = []
    const walk = (nodes: TreeNode[], depth: number, subjectId: string | null) => {
      for (const n of nodes) {
        opts.push({ value: `${subjectId ?? ''}|${n.id}`, label: `${' '.repeat(depth)}${n.title}` })
        walk(n.children, depth + 1, subjectId)
      }
    }
    for (const s of tree.subjects) {
      opts.push({ value: `${s.id}|`, label: s.title })
      walk(s.children, 1, s.id)
    }
    opts.push({ value: '|', label: 'Allgemeine Seiten' })
    walk(tree.general.children, 1, null)
    return opts
  }, [tree])

  const openFolderDialog = () => {
    const sel = onlySelected
    let value = tree.subjects[0] ? `${tree.subjects[0].id}|` : '|'
    if (sel?.kind === 'subject') value = `${sel.id}|`
    else if (sel?.kind === 'page') value = `${index.subjectOf.get(sel.id) ?? ''}|${sel.id}`
    setFolderParent(value)
    setDialog('folder')
  }

  const dragged = dragKeys ? dragKeys.map((k) => index.nodeOf.get(k)!).filter(Boolean) : []

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <div className={`label ${styles.kicker}`}>Bibliothek</div>
          <h1 className={`serif ${styles.title}`}>Verwalten</h1>
        </div>
        <div className={styles.headActions}>
          <button type="button" className={styles.headBtn} onClick={() => setDialog('subject')}>
            + Fach
          </button>
          <button type="button" className={styles.headBtn} onClick={openFolderDialog}>
            + Ordner
          </button>
        </div>
      </div>

      <DndContext
        id="manage-tree"
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={resetDrag}
      >
        <div className={styles.table} role="treegrid" aria-label="Bibliothek">
          <div className={`${styles.row} ${styles.headRow}`} role="row">
            <span />
            <span>NAME</span>
            <span className={styles.colType}>TYP</span>
            <span className={styles.colQuiz}>QUIZ</span>
            <span className={styles.colDate}>GEÄNDERT</span>
          </div>
          {rows.map((r) => (
            <TreeRow
              key={r.key}
              row={r}
              open={open.has(r.key)}
              selected={selected.has(r.key)}
              dragging={Boolean(dragKeys?.includes(r.key))}
              intent={intent?.overKey === r.key ? intent : null}
              flash={flash === r.key}
              now={now}
              onToggle={() => toggleOpen(r.key)}
              onSelect={() => toggleSelect(r.key)}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {dragged.length > 0 && (
            <div className={styles.overlay}>
              <span className={styles.overlayHandle}>⋮⋮</span>
              {dragged.length > 1 ? `${dragged.length} Einträge` : dragged[0].title}
              {dragged.some((n) => n.subtreeQuizCount > 0 || n.quizCount > 0) && <span className={styles.overlayQuiz}>+ QUIZ</span>}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <p className={styles.hint}>
        Ziehen zum Verschieben (auf eine Zeile = hinein, an den Rand = davor/danach). Ein Quiz wandert mit seiner Seite mit.
      </p>

      {validSelected.length > 0 && (
        <div className={styles.selectionBar} role="toolbar" aria-label="Auswahl">
          <span className={styles.selCount}>{validSelected.length} ausgewählt</span>
          <button
            type="button"
            className={styles.selPrimary}
            onClick={() => setDialog('move')}
            disabled={selectedPages.length === 0 || selectedSubjects.length > 0}
            title={selectedSubjects.length ? 'Fächer werden per Drag & Drop sortiert' : undefined}
          >
            Verschieben nach…
          </button>
          <button type="button" className={styles.selBtn} onClick={() => setDialog('rename')} disabled={!onlySelected}>
            Umbenennen
          </button>
          <button type="button" className={`${styles.selBtn} ${styles.selDanger}`} onClick={() => setDialog('delete')}>
            Löschen
          </button>
          <button type="button" className={styles.selClose} onClick={() => setSelected(new Set())} aria-label="Auswahl aufheben">
            ×
          </button>
        </div>
      )}

      <PromptDialog
        open={dialog === 'subject'}
        onClose={() => setDialog(null)}
        kicker="BIBLIOTHEK"
        title="Neues Fach"
        label="Name"
        placeholder="z. B. Biologie"
        submitLabel="Anlegen"
        onSubmit={async (name) => {
          const res = await createSubjectAction(name)
          if (!res.ok) return res.error
          setOpenPersist(new Set([...open, res.subject.id]))
          toast({ message: `Fach „${name}“ angelegt` })
        }}
      />
      <PromptDialog
        open={dialog === 'folder'}
        onClose={() => setDialog(null)}
        kicker="BIBLIOTHEK"
        title="Neuer Ordner"
        label="Name"
        placeholder="z. B. Sporttheorie"
        submitLabel="Anlegen"
        onSubmit={async (title) => {
          const [subjectId, parentId] = folderParent.split('|')
          const res = await createFolderAction({ subjectId: subjectId || null, parentId: parentId || null, title })
          if (!res.ok) return res.error
          const expand = new Set(open)
          if (subjectId) expand.add(subjectId)
          else expand.add('general')
          if (parentId) expand.add(parentId)
          setOpenPersist(expand)
          toast({ message: `Ordner „${title}“ angelegt` })
        }}
      >
        <label className="field">
          <span className="field-label">In</span>
          <select className="input" value={folderParent} onChange={(e) => setFolderParent(e.target.value)}>
            {containerOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </PromptDialog>
      <TreePicker
        open={dialog === 'move'}
        onClose={() => setDialog(null)}
        tree={tree}
        exclude={selectedPages}
        onPick={async (target) => {
          const res = await moveAction(selectedPages, { subjectId: target.subjectId, parentId: target.parentId })
          if (!res.ok) {
            toast({ message: res.error, tone: 'error' })
            return
          }
          const expand = new Set(open)
          if (target.subjectId) expand.add(target.subjectId)
          else expand.add('general')
          if (target.parentId) expand.add(target.parentId)
          setOpenPersist(expand)
          setSelected(new Set())
          toast({ message: `Nach „${target.label}“ verschoben` })
        }}
      />
      {onlySelected && (
        <PromptDialog
          open={dialog === 'rename'}
          onClose={() => setDialog(null)}
          kicker={typeLabel(onlySelected).toUpperCase()}
          title="Umbenennen"
          label="Name"
          initialValue={onlySelected.title}
          submitLabel="Speichern"
          onSubmit={async (name) => {
            const res = await renameAction({ kind: onlySelected.kind === 'subject' ? 'subject' : 'page', id: onlySelected.id }, name)
            if (!res.ok) return res.error
            router.refresh()
          }}
        />
      )}
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        kicker="VERWALTEN"
        title={validSelected.length > 1 ? `${validSelected.length} Einträge löschen?` : 'Löschen?'}
        danger
        confirmLabel="Löschen"
        message={
          <>
            {validSelected.length === 1 ? `„${onlySelected?.title}“` : 'Die ausgewählten Einträge'} werden samt Unterseiten und Quizzen
            gelöscht. Das lässt sich 10 Sekunden lang rückgängig machen.
          </>
        }
        onConfirm={doDelete}
      />
    </div>
  )
}

function TreeRow(props: {
  row: Row
  open: boolean
  selected: boolean
  dragging: boolean
  intent: Intent | null
  flash: boolean
  now: number
  onToggle: () => void
  onSelect: () => void
}) {
  const { row, intent } = props
  const n = row.node
  const draggable = n.kind !== 'general'
  const drag = useDraggable({ id: row.key, disabled: !draggable })
  const drop = useDroppable({ id: row.key })
  const hasChildren = n.children.length > 0
  const showChevron = hasChildren || n.kind !== 'page'
  const padding = row.depth * 22 + (showChevron ? 0 : 8)
  const vars = n.color ? { ['--sh' as string]: n.color.hue, ['--sl' as string]: n.color.lightness, ['--sc' as string]: n.color.chroma } : {}

  const intentClass = !intent
    ? ''
    : !intent.valid
      ? styles.dropInvalid
      : intent.position === 'inside'
        ? styles.dropInside
        : intent.position === 'before'
          ? styles.dropBefore
          : styles.dropAfter

  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el)
        drop.setNodeRef(el)
      }}
      {...(draggable ? drag.attributes : {})}
      {...(draggable ? drag.listeners : {})}
      id={`row-${row.key}`}
      role="row"
      aria-selected={props.selected}
      className={`${styles.row} ${props.selected ? styles.selected : ''} ${props.dragging ? styles.isDragging : ''} ${intentClass} ${props.flash ? styles.flash : ''}`}
      data-subject={n.color ? '' : undefined}
      style={vars}
      tabIndex={-1}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a,button')) return
        if (n.kind !== 'general') props.onSelect()
      }}
    >
      <span className={styles.cellCheck}>
        {n.kind !== 'general' && (
          <button
            type="button"
            role="checkbox"
            aria-checked={props.selected}
            aria-label={`${n.title} auswählen`}
            className={`${styles.check} ${props.selected ? styles.checkOn : ''}`}
            onClick={props.onSelect}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {props.selected ? '✓' : ''}
          </button>
        )}
      </span>
      <span className={`${styles.cellName} ${n.kind !== 'page' ? styles.rootName : ''}`} style={{ paddingLeft: padding }}>
        {showChevron && (
          <button
            type="button"
            className={styles.chev}
            onClick={props.onToggle}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={props.open ? 'Zuklappen' : 'Aufklappen'}
            aria-expanded={props.open}
            disabled={!hasChildren}
          >
            {props.open && hasChildren ? '▾' : '▸'}
          </button>
        )}
        {n.kind === 'subject' && <span className="dot" />}
        {n.kind === 'general' && <span className="dot-general" />}
        <Link href={n.url} className={styles.nameLink} onPointerDown={(e) => e.stopPropagation()} draggable={false}>
          {n.title}
        </Link>
        {n.isNew && n.kind === 'page' && <span className={styles.newTag}>NEU</span>}
        {intent?.valid && intent.position === 'inside' && <span className={styles.dropLabel}>HIER ABLEGEN</span>}
      </span>
      <span className={`${styles.cellMuted} ${styles.colType}`}>{typeLabel(n)}</span>
      <span className={`${styles.cellMuted} ${styles.colQuiz}`}>{quizLabel(n)}</span>
      <span className={`${styles.cellDim} ${styles.colDate}`}>{n.updatedAt ? formatChanged(n.updatedAt, props.now) : '—'}</span>
    </div>
  )
}
