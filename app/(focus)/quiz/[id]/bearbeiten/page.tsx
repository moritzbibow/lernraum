import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { QuizEditor } from '@/components/quiz/QuizEditor'
import { getQuizDetail } from '@/lib/services/quizzes'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const quiz = getQuizDetail((await params).id)
  return { title: quiz ? `Bearbeiten: ${quiz.title}` : 'Quiz bearbeiten' }
}

export default async function EditQuizPage({ params }: Props) {
  const quiz = getQuizDetail((await params).id)
  if (!quiz) notFound()
  return <QuizEditor key={quiz.id} quiz={quiz} />
}
