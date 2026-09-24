import type { Metadata } from 'next'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { firstName, userName } from '@/lib/env'
import { getDashboard } from '@/lib/services/views'
import { initials } from '@/lib/text'
import { serverNow } from '@/lib/format'

export const metadata: Metadata = { title: 'Übersicht' }

export default function HomePage() {
  const now = serverNow()
  return <Dashboard data={getDashboard()} now={now} name={firstName()} initials={initials(userName())} />
}
