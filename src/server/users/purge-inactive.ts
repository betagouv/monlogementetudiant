import { and, count, eq, lt } from 'drizzle-orm'
import { db } from '~/server/db'
import { user } from '~/server/db/schema/auth'
import { deleteUserAccount } from '~/server/users/delete-account'

export const INACTIVE_ACCOUNT_RETENTION_MONTHS = 24

export interface PurgeInactiveAccountsResult {
  purged: number
}

const inactivityCutoff = (): Date => {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - INACTIVE_ACCOUNT_RETENTION_MONTHS)
  return cutoff
}

export const purgeInactiveAccounts = async ({ dryRun = false } = {}): Promise<PurgeInactiveAccountsResult> => {
  const stale = and(eq(user.role, 'user'), lt(user.lastActiveAt, inactivityCutoff()))

  if (dryRun) {
    const [row] = await db.select({ n: count() }).from(user).where(stale)
    return { purged: row?.n ?? 0 }
  }

  const accounts = await db.select({ id: user.id }).from(user).where(stale)

  let purged = 0
  for (const account of accounts) {
    if (await deleteUserAccount(account.id)) purged++
  }

  return { purged }
}
