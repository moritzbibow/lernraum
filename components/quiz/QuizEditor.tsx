'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { saveQuizAction } from '@/lib/actions/quiz'
import type { QuestionType } from '@/lib/db/schema'
import { formatDayMonth } from '@/lib/format'
import type { QuizDetail } from '@/lib/services/quizzes'
import { useToast } from '../ui/Toast'
import styles from './QuizEditor.module.css'

type DraftAnswer = { id: string; text: string; correct: boolean }
type DraftQuestion = {
  id: string
  isNew?: boolean
  type: QuestionType
  prompt: string
  answers: DraftAnswer[]
  explanation: string
  topicId: string | null
}
type Draft = { title: string; questions: DraftQuestion[] }

let tmp = 0
const tmpId = () => `tmp-${Date.now().toString(36)}-${tmp++}`

function toDraft(quiz: QuizDetail): Draft {
  return {
    title: quiz.title,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      answers: q.answers.map((a) => ({ ...a })),
      explanation: q.explanation ?? '',
      topicId: q.topicId,
    })),
  }
}

function issuesOf(q: DraftQuestion): string[] {
  const issues: string[] = []
  if (!q.prompt.trim()) issues.push('Die Frage ist leer.')
  const correct = q.answers.filter((a) => a.correct).length
  if (q.type === 'mc') {
    if (q.answers.length < 2) issues.push('Mindestens zwei Antworten.')
    if (correct !== 1) issues.push('Genau eine Antwort als richtig markieren.')
  }
  if (q.type === 'tf' && correct !== 1) issues.push('Wahr oder Falsch als richtig markieren.')
  if (q.type === 'text' && q.answers.length === 0) issues.push('Mindestens eine akzeptierte Antwort.')
  if (q.answers.some((a) => !a.text.trim())) issues.push('Leere Antworten ausfüllen oder entfernen.')
  return issues
}

function convert(q: DraftQuestion, type: QuestionType): DraftQuestion {
  if (q.type === type) return q
  const correctTexts = q.answers.filter((a) => a.correct).map((a) => a.text)
  if (type === 'tf') {
    const saysFalse = /^(falsch|nein|false)$/i.test(correctTexts[0] ?? '')
    return {
      ...q,
      type,
      answers: [
        { id: tmpId(), text: 'Wahr', correct: !saysFalse },
        { id: tmpId(), text: 'Falsch', correct: saysFalse },
      ],
    }
  }
  if (type === 'text') {
    return { ...q, type, answers: (correctTexts.length ? correctTexts : ['']).map((text) => ({ id: tmpId(), text, correct: true })) }
  }
  // → multiple choice
  const answers = q.answers.map((a, i) => ({ ...a, correct: q.type === 'text' ? i === 0 : a.correct }))
  while (answers.length < 2) answers.push({ id: tmpId(), text: '', correct: answers.length === 0 })
  return { ...q, type, answers }
}

const TYPES: { value: QuestionType; label: string }[] = [
  { value: 'mc', label: 'Multiple Choice' },
  { value: 'tf', label: 'Wahr / Falsch' },
  { value: 'text', label: 'Freitext' },
]

export function QuizEditor({ quiz }: { quiz: QuizDetail }) {
  const router = useRouter()
  const toast = useToast()
  const [saved, setSaved] = useState<Draft>(() => toDraft(quiz))
  const [draft, setDraft] = useState<Draft>(() => toDraft(quiz))
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const savedById = new Map(saved.questions.map((x) => [x.id, JSON.stringify(x)]))
  const invalid = draft.questions.map(issuesOf)
  const hasInvalid = invalid.some((i) => i.length > 0) || !draft.title.trim()
  const q = draft.questions[Math.min(active, draft.questions.length - 1)]
  const activeIndex = draft.questions.indexOf(q)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const update = (patch: Partial<DraftQuestion>) =>
    setDraft((d) => ({ ...d, questions: d.questions.map((x) => (x.id === q.id ? { ...x, ...patch } : x)) }))

  const save = async () => {
    if (!dirty || busy) return
    if (hasInvalid) {
      toast({ message: 'Bitte zuerst die markierten Fragen korrigieren.', tone: 'error' })
      return
    }
    setBusy(true)
    const payload = {
      title: draft.title.trim(),
      questions: draft.questions.map((x) => ({
        id: x.isNew || x.id.startsWith('tmp-') ? undefined : x.id,
        type: x.type,
        prompt: x.prompt.trim(),
        answers: x.answers.map((a) => ({ id: a.id.startsWith('tmp-') ? undefined : a.id, text: a.text.trim(), correct: a.correct })),
        explanation: x.explanation.trim() || null,
        topicId: x.topicId,
      })),
    }
    const res = await saveQuizAction(quiz.id, payload)
    setBusy(false)
    if (!res.ok) {
      toast({ message: res.error, tone: 'error' })
      return
    }
    setSaved(draft)
    toast({ message: 'Gespeichert' })
    router.refresh()
  }

  // Ctrl/Cmd+S – the ref always points at the latest save().
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // Auto-size the question field.
  useEffect(() => {
    const el = promptRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [q?.prompt, q?.id])

  const onQuestionsDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    setDraft((d) => {
      const from = d.questions.findIndex((x) => x.id === e.active.id)
      const to = d.questions.findIndex((x) => x.id === e.over!.id)
      const questions = arrayMove(d.questions, from, to)
      setActive(questions.findIndex((x) => x.id === q.id))
      return { ...d, questions }
    })
  }

  const onAnswersDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = q.answers.findIndex((a) => a.id === e.active.id)
    const to = q.answers.findIndex((a) => a.id === e.over!.id)
    update({ answers: arrayMove(q.answers, from, to) })
  }

  const deleteQuestion = () => {
    if (draft.questions.length <= 1) return
    const index = activeIndex
    const removed = q
    setDraft((d) => ({ ...d, questions: d.questions.filter((x) => x.id !== removed.id) }))
    setActive(Math.max(0, index - 1))
    toast({
      message: `Frage ${String(index + 1).padStart(2, '0')} entfernt – wird mit „Speichern“ übernommen`,
      action: {
        label: 'Rückgängig',
        onClick: () => {
          setDraft((d) => {
            const questions = [...d.questions]
            questions.splice(index, 0, removed)
            return { ...d, questions }
          })
          setActive(index)
        },
      },
    })
  }

  if (!q) return null
  const kicker = ['Quiz', [quiz.trail[0], quiz.trail[quiz.trail.length - 1]].filter(Boolean).join(' › ')].join(' · ')

  return (
    <div className={styles.editor}>
      <aside className={styles.listCol}>
        <div className={styles.listHead}>
          <span className={`label ${styles.kicker}`}>{kicker}</span>
          <input
            className={`serif ${styles.titleInput}`}
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            aria-label="Titel des Quiz"
            maxLength={200}
          />
          <span className={styles.meta}>
            {draft.questions.length} Fragen · {quiz.source === 'claude' ? 'von Claude' : 'zuletzt bearbeitet'} am {formatDayMonth(quiz.source === 'claude' ? quiz.createdAt : quiz.updatedAt)}{' '}
            {quiz.source === 'claude' ? 'eingespeist' : ''}
          </span>
        </div>
        <DndContext id="quiz-questions" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onQuestionsDragEnd}>
          <SortableContext items={draft.questions.map((x) => x.id)} strategy={verticalListSortingStrategy}>
            <div className={styles.list} role="listbox" aria-label="Fragen">
              {draft.questions.map((x, i) => (
                <SortableQuestion
                  key={x.id}
                  id={x.id}
                  index={i}
                  prompt={x.prompt}
                  active={i === activeIndex}
                  changed={savedById.get(x.id) !== JSON.stringify(x)}
                  invalid={invalid[i].length > 0}
                  onSelect={() => setActive(i)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </aside>

      <main className={styles.main}>
        <div className={styles.toolbar}>
          <span className={styles.qNum}>FRAGE {String(activeIndex + 1).padStart(2, '0')}</span>
          {dirty && <span className={styles.unsaved}>UNGESPEICHERT</span>}
          <div className={styles.toolbarActions}>
            <Link href={`/quiz/${quiz.id}`} className={`${styles.tbBtn} ${styles.hideMobile}`}>
              Spielen
            </Link>
            <button
              type="button"
              className={`${styles.tbBtn} ${styles.danger}`}
              onClick={deleteQuestion}
              disabled={draft.questions.length <= 1}
              title={draft.questions.length <= 1 ? 'Die letzte Frage kann nicht gelöscht werden' : undefined}
            >
              Frage löschen
            </button>
            <button type="button" className={`${styles.tbBtn} ${styles.outline}`} onClick={() => setDraft(saved)} disabled={!dirty || busy}>
              Verwerfen
            </button>
            <button type="button" className={`${styles.tbBtn} ${styles.save}`} onClick={save} disabled={!dirty || busy}>
              {busy ? 'Speichert …' : 'Speichern'}
            </button>
          </div>
        </div>

        <div className={styles.form} key={q.id}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Typ</span>
            <div className={styles.segmented} role="radiogroup" aria-label="Fragetyp">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={q.type === t.value}
                  className={`${styles.segment} ${q.type === t.value ? styles.segmentActive : ''}`}
                  onClick={() => setDraft((d) => ({ ...d, questions: d.questions.map((x) => (x.id === q.id ? convert(x, t.value) : x)) }))}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Frage</span>
            <textarea
              ref={promptRef}
              className={`serif ${styles.prompt}`}
              value={q.prompt}
              rows={1}
              onChange={(e) => update({ prompt: e.target.value })}
            />
          </label>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              {q.type === 'text' ? 'Akzeptierte Antworten' : 'Antworten'}{' '}
              <span className={styles.fieldHint}>
                {q.type === 'text' ? '– jede davon zählt als richtig' : '– Punkt markiert die richtige'}
              </span>
            </span>
            {q.type === 'tf' ? (
              q.answers.map((a) => (
                <AnswerRow key={a.id} correct={a.correct} onMark={() => update({ answers: q.answers.map((x) => ({ ...x, correct: x.id === a.id })) })}>
                  <span className={styles.answerStatic}>{a.text}</span>
                </AnswerRow>
              ))
            ) : (
              <DndContext id={`quiz-answers-${q.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onAnswersDragEnd}>
                <SortableContext items={q.answers.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                  {q.answers.map((a, i) => (
                    <SortableAnswer
                      key={a.id}
                      id={a.id}
                      correct={a.correct}
                      showRadio={q.type === 'mc'}
                      onMark={() => update({ answers: q.answers.map((x) => ({ ...x, correct: x.id === a.id })) })}
                      onRemove={
                        q.answers.length > (q.type === 'mc' ? 2 : 1)
                          ? () => update({ answers: q.answers.filter((x) => x.id !== a.id) })
                          : undefined
                      }
                    >
                      <input
                        className={styles.answerInput}
                        value={a.text}
                        placeholder={q.type === 'text' ? 'Akzeptierte Antwort' : `Antwort ${String.fromCharCode(65 + i)}`}
                        onChange={(e) =>
                          update({ answers: q.answers.map((x) => (x.id === a.id ? { ...x, text: e.target.value } : x)) })
                        }
                      />
                    </SortableAnswer>
                  ))}
                </SortableContext>
              </DndContext>
            )}
            {q.type !== 'tf' && q.answers.length < 8 && (
              <button
                type="button"
                className={styles.addAnswer}
                onClick={() => update({ answers: [...q.answers, { id: tmpId(), text: '', correct: q.type === 'text' }] })}
              >
                + {q.type === 'text' ? 'Alternative' : 'Antwort'}
              </button>
            )}
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              Erklärung <span className={styles.fieldHint}>– wird nach der Antwort gezeigt</span>
            </span>
            <textarea
              className={styles.explanation}
              value={q.explanation}
              rows={3}
              placeholder="Warum ist das die richtige Antwort?"
              onChange={(e) => update({ explanation: e.target.value })}
            />
          </label>

          {quiz.page.topics.length > 0 && (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                Thema <span className={styles.fieldHint}>– Ziel für „Zur Seite →“</span>
              </span>
              <select className={styles.select} value={q.topicId ?? ''} onChange={(e) => update({ topicId: e.target.value || null })}>
                <option value="">Ganze Seite</option>
                {quiz.page.topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          {invalid[activeIndex].length > 0 && (
            <ul className={styles.issues}>
              {invalid[activeIndex].map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}

function SortableQuestion(props: {
  id: string
  index: number
  prompt: string
  active: boolean
  changed: boolean
  invalid: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${styles.qItem} ${props.active ? styles.qItemActive : ''} ${isDragging ? styles.dragging : ''}`}
      role="option"
      aria-selected={props.active}
      tabIndex={0}
      onClick={props.onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          props.onSelect()
        }
      }}
    >
      <span className={styles.handle} {...attributes} {...listeners} aria-label="Ziehen zum Sortieren" onClick={(e) => e.stopPropagation()}>
        ⋮⋮
      </span>
      <span className={styles.qIndex}>{String(props.index + 1).padStart(2, '0')}</span>
      <span className={styles.qText}>{props.prompt || 'Leere Frage'}</span>
      {props.invalid ? <span className={styles.flagInvalid} title="Unvollständig" /> : props.changed ? <span className={styles.flagChanged} title="Geändert" /> : null}
    </div>
  )
}

function AnswerRow({ correct, onMark, children }: { correct: boolean; onMark: () => void; children: ReactNode }) {
  return (
    <div className={`${styles.answer} ${correct ? styles.answerCorrect : ''}`}>
      <button type="button" className={`${styles.radio} ${correct ? styles.radioOn : ''}`} onClick={onMark} aria-label="Als richtig markieren" aria-pressed={correct} />
      {children}
    </div>
  )
}

function SortableAnswer(props: {
  id: string
  correct: boolean
  showRadio: boolean
  onMark: () => void
  onRemove?: () => void
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${styles.answer} ${props.showRadio && props.correct ? styles.answerCorrect : ''} ${isDragging ? styles.dragging : ''}`}
    >
      {props.showRadio ? (
        <button
          type="button"
          className={`${styles.radio} ${props.correct ? styles.radioOn : ''}`}
          onClick={props.onMark}
          aria-label="Als richtig markieren"
          aria-pressed={props.correct}
        />
      ) : (
        <span className={styles.bullet} />
      )}
      {props.children}
      {props.onRemove && (
        <button type="button" className={styles.remove} onClick={props.onRemove} aria-label="Antwort entfernen">
          ×
        </button>
      )}
      <span className={styles.handleRight} {...attributes} {...listeners} aria-label="Ziehen zum Sortieren">
        ⋮⋮
      </span>
    </div>
  )
}
