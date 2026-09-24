'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { deleteAction, moveQuizAction, renameAction, restoreAction } from '@/lib/actions/library'
import { useApp } from '../providers/AppProviders'
import { ConfirmDialog, PromptDialog } from '../ui/dialogs'
import { Menu } from '../ui/Menu'
import { useToast } from '../ui/Toast'
import { TreePicker } from '../ui/TreePicker'
import styles from './Lists.module.css'

export function QuizRowActions({ quiz }: { quiz: { id: string; title: string; pageId: string } }) {
  const router = useRouter()
  const toast = useToast()
  const { tree } = useApp()
  const [dialog, setDialog] = useState<'rename' | 'move' | 'delete' | null>(null)

  return (
    <div className={styles.rowActions}>
      <Link href={`/quiz/${quiz.id}`} className={styles.play}>
        Spielen
      </Link>
      <Link href={`/quiz/${quiz.id}/bearbeiten`} className={`${styles.iconBtn} ${styles.hideMobile}`}>
        Bearbeiten
      </Link>
      <Menu
        items={[
          { label: 'Bearbeiten', onSelect: () => router.push(`/quiz/${quiz.id}/bearbeiten`) },
          { label: 'Umbenennen', onSelect: () => setDialog('rename') },
          { label: 'An andere Seite hängen…', onSelect: () => setDialog('move') },
          { label: 'Löschen', danger: true, onSelect: () => setDialog('delete') },
        ]}
        trigger={(p) => (
          <button type="button" className={styles.iconBtn} aria-label={`Aktionen für ${quiz.title}`} {...p}>
            ···
          </button>
        )}
      />
      <PromptDialog
        open={dialog === 'rename'}
        onClose={() => setDialog(null)}
        kicker="QUIZ"
        title="Umbenennen"
        label="Titel"
        initialValue={quiz.title}
        submitLabel="Speichern"
        onSubmit={async (name) => {
          const res = await renameAction({ kind: 'quiz', id: quiz.id }, name)
          if (!res.ok) return res.error
          router.refresh()
        }}
      />
      <TreePicker
        open={dialog === 'move'}
        onClose={() => setDialog(null)}
        tree={tree}
        mode="page"
        title="An Seite hängen…"
        confirmLabel="Hierher"
        onPick={async (target) => {
          if (!target.pageId) return
          const res = await moveQuizAction(quiz.id, target.pageId)
          if (!res.ok) toast({ message: res.error, tone: 'error' })
          else {
            toast({ message: `Quiz hängt jetzt an „${target.label}“` })
            router.refresh()
          }
        }}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        kicker="QUIZ"
        title="Quiz löschen?"
        danger
        confirmLabel="Löschen"
        message={<>„{quiz.title}“ wird gelöscht. Das lässt sich 10 Sekunden lang rückgängig machen.</>}
        onConfirm={async () => {
          const res = await deleteAction([{ kind: 'quiz', id: quiz.id }])
          if (!res.ok) {
            toast({ message: res.error, tone: 'error' })
            return
          }
          router.refresh()
          toast({
            message: `„${quiz.title}“ gelöscht`,
            action: {
              label: 'Rückgängig',
              onClick: async () => {
                await restoreAction(res.batch)
                router.refresh()
              },
            },
          })
        }}
      />
    </div>
  )
}
