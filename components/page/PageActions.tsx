'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { deleteAction, moveAction, renameAction, restoreAction } from '@/lib/actions/library'
import { useApp } from '../providers/AppProviders'
import { ConfirmDialog, PromptDialog } from '../ui/dialogs'
import { Menu } from '../ui/Menu'
import { useToast } from '../ui/Toast'
import { TreePicker } from '../ui/TreePicker'
import styles from './Page.module.css'

type Props = {
  pageId: string
  title: string
  parentUrl: string
  quizzes: { id: string; title: string }[]
  childCount: number
}

/** "Verschieben" + "···" in the breadcrumb bar (screen 3a). */
export function PageActions({ pageId, title, parentUrl, quizzes, childCount }: Props) {
  const router = useRouter()
  const toast = useToast()
  const { tree } = useApp()
  const [dialog, setDialog] = useState<'move' | 'rename' | 'delete' | null>(null)

  const items = [
    { label: 'Umbenennen', onSelect: () => setDialog('rename') },
    ...quizzes.flatMap((q) => [
      { label: quizzes.length > 1 ? `„${q.title}“ spielen` : 'Quiz spielen', onSelect: () => router.push(`/quiz/${q.id}`) },
      { label: quizzes.length > 1 ? `„${q.title}“ bearbeiten` : 'Quiz bearbeiten', onSelect: () => router.push(`/quiz/${q.id}/bearbeiten`) },
    ]),
    { label: 'In Verwalten zeigen', onSelect: () => router.push(`/verwalten#${pageId}`) },
    { label: 'Löschen', danger: true, onSelect: () => setDialog('delete') },
  ]

  return (
    <div className={styles.barActions}>
      <button type="button" className={styles.barBtn} onClick={() => setDialog('move')}>
        Verschieben
      </button>
      <Menu
        items={items}
        trigger={(p) => (
          <button type="button" className={styles.barBtn} aria-label="Weitere Aktionen" {...p}>
            ···
          </button>
        )}
      />

      <TreePicker
        open={dialog === 'move'}
        onClose={() => setDialog(null)}
        tree={tree}
        exclude={[pageId]}
        onPick={async (target) => {
          const res = await moveAction([pageId], { subjectId: target.subjectId, parentId: target.parentId })
          if (!res.ok) {
            toast({ message: res.error, tone: 'error' })
            return
          }
          toast({ message: `Verschoben nach „${target.label}“` })
          router.push(`/p/${pageId}`)
        }}
      />

      <PromptDialog
        open={dialog === 'rename'}
        onClose={() => setDialog(null)}
        kicker="LERNSEITE"
        title="Umbenennen"
        label="Titel"
        initialValue={title}
        submitLabel="Speichern"
        onSubmit={async (name) => {
          const res = await renameAction({ kind: 'page', id: pageId }, name)
          if (!res.ok) return res.error
          router.push(`/p/${pageId}`)
        }}
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        kicker="LERNSEITE"
        title="Seite löschen?"
        danger
        confirmLabel="Löschen"
        message={
          <>
            „{title}“{childCount > 0 ? ` und ${childCount === 1 ? 'eine Unterseite' : `${childCount} Unterseiten`}` : ''}
            {quizzes.length > 0 ? ' samt Quiz' : ''} werden gelöscht. Du kannst das 10 Sekunden lang rückgängig machen.
          </>
        }
        onConfirm={async () => {
          const res = await deleteAction([{ kind: 'page', id: pageId }])
          if (!res.ok) {
            toast({ message: res.error, tone: 'error' })
            return
          }
          router.push(parentUrl)
          toast({
            message: `„${title}“ gelöscht`,
            action: {
              label: 'Rückgängig',
              onClick: async () => {
                const r = await restoreAction(res.batch)
                if (r.ok) router.push(`/p/${pageId}`)
              },
            },
          })
        }}
      />
    </div>
  )
}
