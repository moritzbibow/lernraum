import type { Metadata } from 'next'
import { ManageView } from '@/components/manage/ManageView'
import { serverNow } from '@/lib/format'

export const metadata: Metadata = { title: 'Verwalten' }

export default function ManagePage() {
  return <ManageView now={serverNow()} />
}
