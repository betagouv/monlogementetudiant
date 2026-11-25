import { and, count, eq, lt } from 'drizzle-orm'
import { db } from '~/server/db'
import { user } from '~/server/db/schema/auth'
import { deleteUserAccount } from '~/server/users/delete-account'

/**
 * Durée de conservation d'un compte étudiant sans connexion (référence CNIL pour ce type de
 * service). La relance avant suppression viendra d'un plan de communication dédié : tant qu'il
 * n'existe pas, le délai court depuis le déploiement de la colonne `last_active_at`, ce qui
 * laisse 24 mois pour la mettre en place avant la première vague.
 */
export const INACTIVE_ACCOUNT_RETENTION_MONTHS = 24

export interface PurgeInactiveAccountsResult {
  /** Comptes étudiants supprimés (données emportées par cascade, contact Brevo retiré). */
  purged: number
}

const inactivityCutoff = (): Date => {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - INACTIVE_ACCOUNT_RETENTION_MONTHS)
  return cutoff
}

/**
 * Purge RGPD des comptes étudiants inactifs.
 *
 * Seuls les comptes `role = 'user'` sont concernés : les comptes gestionnaires et admins sont
 * des comptes professionnels gérés par l'administration. La suppression passe par
 * `deleteUserAccount`, le même effacement intégral que la suppression en libre-service
 * (cascades + contact Brevo). Idempotent : un compte purgé ne réapparaît pas.
 */
export const purgeInactiveAccounts = async ({ dryRun = false } = {}): Promise<PurgeInactiveAccountsResult> => {
  const stale = and(eq(user.role, 'user'), lt(user.lastActiveAt, inactivityCutoff()))

  if (dryRun) {
    const [row] = await db.select({ n: count() }).from(user).where(stale)
    return { purged: row?.n ?? 0 }
  }

  const accounts = await db.select({ id: user.id }).from(user).where(stale)

  // Un compte à la fois : chaque suppression déclenche son nettoyage Brevo, et un échec
  // individuel ne doit pas bloquer le reste du lot.
  let purged = 0
  for (const account of accounts) {
    if (await deleteUserAccount(account.id)) purged++
  }

  return { purged }
}
