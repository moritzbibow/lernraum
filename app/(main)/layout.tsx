import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { AppProviders } from '@/components/providers/AppProviders'
import { MobileNav } from '@/components/shell/MobileNav'
import styles from '@/components/shell/Shell.module.css'
import { Sidebar } from '@/components/shell/Sidebar'
import { requireSession } from '@/lib/auth/session'
import { inboxSignature } from '@/lib/services/inbox'
import { buildTree } from '@/lib/services/tree'

export default async function MainLayout({ children }: { children: ReactNode }) {
  await requireSession()
  const theme = (await cookies()).get('lr_theme')?.value === 'light' ? 'light' : 'dark'
  return (
    <AppProviders tree={buildTree()} theme={theme} inbox={inboxSignature()}>
      <div className={styles.shell}>
        <Sidebar />
        <main className={styles.main}>{children}</main>
      </div>
      <MobileNav />
    </AppProviders>
  )
}
