import { eq } from 'drizzle-orm'
import { db } from '~/server/db'
import { user } from '~/server/db/schema/auth'
import { env } from '~/server/env'
import { deleteBrevoContact } from '~/server/services/brevo'
import { maskEmail } from '~/utils/mask-email'

/**
 * Supprime définitivement un compte et toutes ses données (effacement RGPD).
 *
 * La suppression de la ligne `user` emporte tout par cascade : sessions, comptes d'auth,
 * demandes de contact, dossier DossierFacile (documents et candidatures), alertes, favoris,
 * simulations, objectifs et tickets. Choix produit assumé : les candidatures encore dans la
 * fenêtre de rétention disparaissent aussi des listes gestionnaires et des statistiques.
 *
 * Retourne la ligne supprimée, ou null si le compte n'existe pas (idempotent).
 */
export async function deleteUserAccount(userId: string): Promise<{ id: string; email: string } | null> {
  const [deleted] = await db.delete(user).where(eq(user.id, userId)).returning({ id: user.id, email: user.email })
  if (!deleted) return null

  await removeBrevoContact(deleted.email)
  return deleted
}

/**
 * Nettoyage Brevo en meilleur effort : la suppression locale est déjà actée, un Brevo
 * indisponible ne doit pas la faire échouer — l'erreur est journalisée pour reprise manuelle.
 */
async function removeBrevoContact(email: string): Promise<void> {
  if (env.NEXT_PUBLIC_APP_ENV !== 'production') {
    console.info(`[${env.NEXT_PUBLIC_APP_ENV}] suppression du contact Brevo ignorée pour ${maskEmail(email)}`)
    return
  }

  try {
    await deleteBrevoContact(email)
  } catch (error) {
    console.error(`Échec de la suppression du contact Brevo pour ${maskEmail(email)}`, error)
  }
}
