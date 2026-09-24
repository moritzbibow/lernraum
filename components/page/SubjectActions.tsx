'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createFolderAction, deleteAction, renameAction, restoreAction } from '@/lib/actions/library'
import { ConfirmDialog, PromptDialog } from '../ui/dialogs'
import { Menu } from '../ui/Menu'
import { useToast } from '../ui/Toast'
import styles from './Page.module.css'

/** Actions for a subject (or the general pages container). */
export function SubjectActions({ subject }: { subject: { id: string; name: string } | null }) {
  const router = useRouter()
  const toast = useToast()
  const [dialog, setDialog] = useState<'folder' | 'rename' | 'delete' | null>(null)

  const items = [
    { label: 'Neuer Ordner', onSelect: () => setDialog('folder') },
    ...(subject
      ? [
          { label: 'Umbenennen', onSelect: () => setDialog('rename') },
          { label: 'In Verwalten zeigen', onSelect: () => router.push(`/verwalten#${subject.id}`) },
          { label: 'Fach löschen', danger: true, onSelect: () => setDialog('delete') },
        ]
      : []),
  ]

  return (
    <div className={styles.barActions}>
      <Menu
        items={items}
        trigger={(p) => (
          <button type="button" className={styles.barBtn} aria-label="Weitere Aktionen" {...p}>
            ···
          </button>
        )}
      />
      <PromptDialog
        open={dialog === 'folder'}
        onClose={() => setDialog(null)}
        kicker={subject ? subject.name.toUpperCase() : 'ALLGEMEIN'}
        title="Neuer Ordner"
        label="Name"
        placeholder="z. B. Sporttheorie"
        submitLabel="Anlegen"
        onSubmit={async (title) => {
          const res = await createFolderAction({ subjectId: subject?.id ?? null, parentId: null, title })
          if (!res.ok) return res.error
          toast({ message: `Ordner „${title}“ angelegt` })
          router.refresh()
        }}
      />
      {subject && (
        <>
          <PromptDialog
            open={dialog === 'rename'}
            onClose={() => setDialog(null)}
            kicker="FACH"
            title="Umbenennen"
            label="Name"
            initialValue={subject.name}
            submitLabel="Speichern"
            onSubmit={async (name) => {
              const res = await renameAction({ kind: 'subject', id: subject.id }, name)
              if (!res.ok) return res.error
              router.push('/bibliothek')
            }}
          />
          <ConfirmDialog
            open={dialog === 'delete'}
            onClose={() => setDialog(null)}
            kicker="FACH"
            title="Fach löschen?"
            danger
            confirmLabel="Löschen"
            message={<>„{subject.name}“ wird mit allen Seiten und Quizzen gelöscht. Das lässt sich 10 Sekunden lang rückgängig machen.</>}
            onConfirm={async () => {
              const res = await deleteAction([{ kind: 'subject', id: subject.id }])
              if (!res.ok) {
                toast({ message: res.error, tone: 'error' })
                return
              }
              router.push('/')
              toast({
                message: `„${subject.name}“ gelöscht`,
                action: { label: 'Rückgängig', onClick: async () => void (await restoreAction(res.batch)) },
              })
            }}
          />
        </>
      )}
    </div>
  )
}
