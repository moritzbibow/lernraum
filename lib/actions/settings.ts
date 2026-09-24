'use server'

import { revalidatePath } from 'next/cache'
import { disconnectClient } from '../auth/oauth'
import { assertSession } from '../auth/session'
import { createBackup } from '../services/maintenance'

export async function disconnectClientAction(form: FormData): Promise<void> {
  await assertSession()
  const id = String(form.get('clientId') ?? '')
  if (id) disconnectClient(id)
  revalidatePath('/einstellungen')
}

export async function backupNowAction(): Promise<void> {
  await assertSession()
  await createBackup()
  revalidatePath('/einstellungen')
}
