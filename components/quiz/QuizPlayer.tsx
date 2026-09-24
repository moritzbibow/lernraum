'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { markQuizOpenedAction, recordAttemptAction } from '@/lib/actions/quiz'
import { checkFreeText } from '@/lib/quiz-check'
import type { QuizDetail } from '@/lib/services/quizzes'
import styles from './QuizPlayer.module.css'

type Result = { correct: boolean; choice?: number; text?: string; overridden?: boolean }

const TYPE_LABEL = { mc: 'Multiple Choice', tf: 'Wahr oder Falsch', text: 'Freitext' } as const
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

function verdict(pct: number) {
  if (pct >= 90) return 'Stark!'
  if (pct >= 70) return 'Gut gemacht.'
  if (pct >= 50) return 'Solide – wiederhol die falschen.'
  return 'Da geht noch was. Einmal lesen, dann nochmal.'
}

export function QuizPlayer({ quiz }: { quiz: QuizDetail }) {
  const router = useRouter()
  const all = useMemo(() => quiz.questions.map((_, i) => i), [quiz.questions])
  const [round, setRound] = useState<{ order: number[]; isRetry: boolean }>({ order: all, isRetry: false })
  const [pos, setPos] = useState(0)
  const [results, setResults] = useState<Record<string, Result>>({})
  const [text, setText] = useState('')
  const [done, setDone] = useState(false)
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    markQuizOpenedAction(quiz.id).catch(() => {})
  }, [quiz.id])

  const q = quiz.questions[round.order[pos]]
  const result = q ? results[q.id] : undefined
  const answered = Boolean(result)

  const answerChoice = useCallback(
    (index: number) => {
      if (!q || answered || q.type === 'text' || index >= q.answers.length) return
      setResults((r) => ({ ...r, [q.id]: { correct: q.answers[index].correct, choice: index } }))
    },
    [q, answered],
  )

  const answerText = useCallback(() => {
    if (!q || answered || q.type !== 'text' || !text.trim()) return
    const accepted = q.answers.map((a) => a.text)
    setResults((r) => ({ ...r, [q.id]: { correct: checkFreeText(text, accepted), text } }))
  }, [q, answered, text])

  const finish = useCallback(
    (final: Record<string, Result>) => {
      setDone(true)
      if (round.isRetry) return
      setSaved('saving')
      recordAttemptAction(
        quiz.id,
        quiz.questions.map((x) => ({ questionId: x.id, correct: Boolean(final[x.id]?.correct) })),
      )
        .then((res) => setSaved(res.ok ? 'saved' : 'error'))
        .catch(() => setSaved('error'))
    },
    [quiz.id, quiz.questions, round.isRetry],
  )

  const next = useCallback(() => {
    if (!answered) return
    setText('')
    if (pos + 1 < round.order.length) setPos(pos + 1)
    else finish(results)
  }, [answered, pos, round.order.length, finish, results])

  // Focus management
  useEffect(() => {
    if (done) return
    if (q?.type === 'text' && !answered) inputRef.current?.focus()
  }, [q, answered, done])

  // Keyboard: A–D / 1–4 choose, Enter continues, Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') {
        router.push(quiz.page.url)
        return
      }
      if (done) return
      const target = e.target as HTMLElement
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
      if (e.key === 'Enter') {
        if (typing && !answered) return // handled by the form
        if (answered) {
          e.preventDefault()
          next()
        }
        return
      }
      if (typing || answered || !q || q.type === 'text') return
      const letter = LETTERS.indexOf(e.key.toUpperCase())
      const digit = Number(e.key) - 1
      const index = letter >= 0 ? letter : Number.isInteger(digit) && digit >= 0 ? digit : -1
      if (index >= 0) {
        e.preventDefault()
        answerChoice(index)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [q, answered, done, next, answerChoice, router, quiz.page.url])

  const restart = (order: number[], isRetry: boolean) => {
    setResults((r) => {
      const copy = { ...r }
      for (const i of order) delete copy[quiz.questions[i].id]
      return copy
    })
    setRound({ order, isRetry })
    setPos(0)
    setText('')
    setDone(false)
    setSaved('idle')
  }

  const kicker = quiz.trail.join(' › ')
  const topicUrl = (topicId: string | null) => (topicId ? `${quiz.page.url}#t-${topicId}` : quiz.page.url)

  if (quiz.questions.length === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.center}>
          <p className={styles.hint}>Dieses Quiz hat keine Fragen.</p>
          <Link href={quiz.page.url} className="btn btn-outline">
            Zur Seite
          </Link>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------ results
  if (done) {
    const order = round.order
    const correct = order.filter((i) => results[quiz.questions[i].id]?.correct).length
    const wrong = order.filter((i) => !results[quiz.questions[i].id]?.correct)
    const pct = Math.round((correct / order.length) * 100)
    return (
      <div className={styles.screen}>
        <Header kicker={kicker} title={quiz.title} closeUrl={quiz.page.url} counter={`${order.length} / ${order.length}`} />
        <Segments order={order} pos={order.length} questions={quiz.questions} results={results} />
        <main className={styles.center}>
          <div className={styles.inner}>
            <span className={`label ${styles.qLabel}`}>{round.isRetry ? 'Wiederholung' : 'Ergebnis'}</span>
            <div className={`serif ${styles.score}`}>
              {correct} / {order.length}
            </div>
            <p className={styles.scoreSub}>
              {pct} % richtig · {verdict(pct)}
              {!round.isRetry && quiz.lastAttempt && ` Letztes Mal: ${quiz.lastAttempt.score} / ${quiz.lastAttempt.total}.`}
              {saved === 'error' && ' (Ergebnis konnte nicht gespeichert werden.)'}
            </p>
            {wrong.length > 0 && (
              <div className={styles.review}>
                {wrong.map((i) => {
                  const x = quiz.questions[i]
                  const right = x.answers.filter((a) => a.correct).map((a) => a.text)
                  return (
                    <div key={x.id} className={styles.reviewItem}>
                      <span className={`serif ${styles.reviewQ}`}>{x.prompt}</span>
                      <span className={styles.reviewA}>
                        Richtig: {x.type === 'text' ? right.join(' / ') : right[0]}
                        <Link href={topicUrl(x.topicId)} className={styles.whyLink}>
                          Zur Seite →
                        </Link>
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            <div className={styles.resultActions}>
              {wrong.length > 0 && (
                <button type="button" className={styles.primary} onClick={() => restart(wrong, true)} autoFocus>
                  Falsche wiederholen ({wrong.length})
                </button>
              )}
              <button type="button" className={styles.secondary} onClick={() => restart(all, false)} autoFocus={wrong.length === 0}>
                Nochmal von vorn
              </button>
              <Link href={quiz.page.url} className={styles.textLink}>
                Zur Seite
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ------------------------------------------------------------ question
  const choiceIndex = result?.choice
  return (
    <div className={styles.screen}>
      <Header kicker={kicker} title={quiz.title} closeUrl={quiz.page.url} counter={`${pos + 1} / ${round.order.length}`} />
      <Segments order={round.order} pos={pos} questions={quiz.questions} results={results} />
      <main className={styles.center}>
        <div className={styles.inner} key={q.id}>
          <span className={`label ${styles.qLabel}`}>
            Frage {pos + 1} · {TYPE_LABEL[q.type]}
          </span>
          <h1 className={`serif ${styles.question}`}>{q.prompt}</h1>

          {q.type !== 'text' ? (
            <div className={styles.answers} role="radiogroup" aria-label="Antworten">
              {q.answers.map((a, i) => {
                const isChoice = choiceIndex === i
                const state = !answered ? '' : a.correct ? styles.correct : isChoice ? styles.wrong : styles.dimmed
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={isChoice}
                    className={`${styles.answer} ${state}`}
                    onClick={() => answerChoice(i)}
                    disabled={answered}
                  >
                    <span className={styles.letter}>{LETTERS[i]}</span>
                    <span className={styles.answerText}>{a.text}</span>
                    {answered && a.correct && <span className={`${styles.verdict} ${styles.verdictRight}`}>RICHTIG</span>}
                    {answered && isChoice && !a.correct && <span className={`${styles.verdict} ${styles.verdictWrong}`}>FALSCH</span>}
                  </button>
                )
              })}
            </div>
          ) : (
            <form
              className={styles.textForm}
              onSubmit={(e) => {
                e.preventDefault()
                answerText()
              }}
            >
              <input
                ref={inputRef}
                className={`${styles.textInput} ${answered ? (result?.correct ? styles.correct : styles.wrong) : ''}`}
                value={answered ? (result?.text ?? '') : text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Deine Antwort …"
                readOnly={answered}
                autoComplete="off"
                spellCheck={false}
              />
              {!answered && (
                <button type="submit" className={styles.check} disabled={!text.trim()}>
                  Prüfen
                </button>
              )}
              {answered && (
                <div className={styles.expected}>
                  <span className={`${styles.verdict} ${result?.correct ? styles.verdictRight : styles.verdictWrong}`}>
                    {result?.correct ? 'RICHTIG' : 'FALSCH'}
                  </span>
                  <span>
                    Erwartet: <strong>{q.answers.map((a) => a.text).join(' / ')}</strong>
                  </span>
                  {!result?.correct && (
                    <button
                      type="button"
                      className={styles.override}
                      onClick={() => setResults((r) => ({ ...r, [q.id]: { ...r[q.id], correct: true, overridden: true } }))}
                    >
                      Doch richtig
                    </button>
                  )}
                </div>
              )}
            </form>
          )}

          {answered && (q.explanation || !result?.correct) && (
            <div className={styles.why}>
              <span className={styles.whyLabel}>WARUM</span>
              <span>
                {q.explanation ?? 'Schau dir den Abschnitt auf der Lernseite noch einmal an.'}{' '}
                <Link href={topicUrl(q.topicId)} className={styles.whyLink}>
                  Zur Seite →
                </Link>
              </span>
            </div>
          )}
        </div>
      </main>
      <footer className={styles.footer}>
        <span className={styles.hint}>
          {q.type === 'text' ? 'Tastatur: Enter prüfen · Enter weiter' : `Tastatur: ${LETTERS[0]}–${LETTERS[q.answers.length - 1]} wählen · Enter weiter`}
        </span>
        <button type="button" className={styles.next} onClick={next} disabled={!answered}>
          {pos + 1 < round.order.length ? 'Weiter' : 'Auswerten'}
        </button>
      </footer>
    </div>
  )
}

function Header({ kicker, title, closeUrl, counter }: { kicker: string; title: string; closeUrl: string; counter: string }) {
  return (
    <header className={styles.header}>
      <Link href={closeUrl} className={styles.close} aria-label="Quiz schließen">
        ✕
      </Link>
      <div className={styles.titleBlock}>
        <span className={`label ${styles.kicker}`}>{kicker}</span>
        <span className={styles.quizTitle}>{title}</span>
      </div>
      <span className={styles.counter}>{counter}</span>
    </header>
  )
}

function Segments({
  order,
  pos,
  questions,
  results,
}: {
  order: number[]
  pos: number
  questions: QuizDetail['questions']
  results: Record<string, Result>
}) {
  return (
    <div className={styles.segments} aria-hidden>
      {order.map((qi, i) => {
        const r = results[questions[qi].id]
        const cls = i === pos ? styles.segCurrent : r ? (r.correct ? styles.segRight : styles.segWrong) : ''
        return <span key={questions[qi].id} className={`${styles.seg} ${cls}`} />
      })}
    </div>
  )
}
