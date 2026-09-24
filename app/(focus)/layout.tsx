import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { AppProviders } from '@/components/providers/AppProviders'
import { IconRail } from '@/components/shell/IconRail'
import { MobileNav } from '@/components/shell/MobileNav'
import styles from '@/components/shell/Shell.module.css'
import { requireSession } from '@/lib/auth/session'
import { inboxSignature } from '@/lib/services/inbox'
import { buildTree } from '@/lib/services/tree'

/** Focus screens (Quiz bearbeiten, Verwalten) use the 72px icon rail instead of the sidebar. */
export default async function FocusLayout({ children }: { children: ReactNode }) {
  await requireSession()
  const theme = (await cookies()).get('lr_theme')?.value === 'light' ? 'light' : 'dark'
  return (
    <AppProviders tree={buildTree()} theme={theme} inbox={inboxSignature()}>
      <div className={styles.shell}>
        <IconRail />
        <main className={styles.main}>{children}</main>
      </div>
      <MobileNav />
    </AppProviders>
  )
}
