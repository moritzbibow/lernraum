import type { ReactNode } from 'react'
import { requireSession } from '@/lib/auth/session'

/** Quiz spielen: full screen, no chrome. */
export default async function PlayLayout({ children }: { children: ReactNode }) {
  await requireSession()
  return children
}
