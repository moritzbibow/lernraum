import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { QuizPlayer } from '@/components/quiz/QuizPlayer'
import { softHyphenate } from '@/lib/hyphenate'
import { getQuizDetail } from '@/lib/services/quizzes'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const quiz = getQuizDetail((await params).id)
  return { title: quiz ? `Quiz: ${quiz.title}` : 'Quiz' }
}

export default async function PlayQuizPage({ params }: Props) {
  const quiz = getQuizDetail((await params).id)
  if (!quiz) notFound()
  // Long German words in the 42px question get soft hyphens.
  const prepared = { ...quiz, questions: quiz.questions.map((q) => ({ ...q, prompt: softHyphenate(q.prompt) })) }
  return <QuizPlayer quiz={prepared} />
}
