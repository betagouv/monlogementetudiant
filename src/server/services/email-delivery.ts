import { db } from '~/server/db'
import { emailInterceptionSettings } from '~/server/db/schema'
import { env } from '~/server/env'

/**
 * Interception des emails hors production (ADR 0003).
 *
 * `auth` : emails de connexion (magic link, validation, réinitialisation, activation). Partent
 * toujours au destinataire réel pour permettre l'accès aux espaces, même hors prod.
 * `standard` : tout le reste (campagne contacts, confirmations, notifications, tickets support).
 */
export type EmailCategory = 'auth' | 'standard'

export type DeliveryDecision = { action: 'send'; recipients: string[] } | { action: 'drop'; reason: string }

type AppEnv = typeof env.NEXT_PUBLIC_APP_ENV

interface ResolveDeliveryParams {
  appEnv: AppEnv
  category: EmailCategory
  recipients: string[]
  /** Adresse catch-all retenue (admin › env), ou null si aucune. */
  redirectEmail: string | null
  bypassRedirect: boolean
}

/**
 * Décide du sort d'un envoi. Fonction pure — testable sans base ni réseau.
 *
 * Ordre : production → auth → bypass → redirection → drop (fail-safe).
 */
export function resolveDelivery({ appEnv, category, recipients, redirectEmail, bypassRedirect }: ResolveDeliveryParams): DeliveryDecision {
  // En production, aucun comportement n'est modifié : le verrou n'existe pas.
  if (appEnv === 'production') return { action: 'send', recipients }
  // Emails de connexion : toujours au destinataire réel (accès aux espaces).
  if (category === 'auth') return { action: 'send', recipients }
  // Bypass explicite depuis l'admin : on renvoie aux destinataires réels.
  if (bypassRedirect) return { action: 'send', recipients }
  // Redirection vers la catch-all si disponible, sinon drop + log (fail-safe).
  if (redirectEmail) return { action: 'send', recipients: [redirectEmail] }
  return { action: 'drop', reason: 'aucune adresse de redirection configurée' }
}

/**
 * Résout l'envoi en lisant les réglages (admin en base › variable d'env). Court-circuite en
 * production (aucune lecture de base). Tolère l'absence de base (tests unitaires, scripts isolés) :
 * repli silencieux sur la variable d'env.
 */
export async function resolveEmailDelivery(category: EmailCategory, recipients: string[]): Promise<DeliveryDecision> {
  if (env.NEXT_PUBLIC_APP_ENV === 'production') return { action: 'send', recipients }

  let redirectEmail: string | null = env.STAGING_EMAIL_REDIRECT ?? null
  let bypassRedirect = false

  try {
    const [row] = await db.select().from(emailInterceptionSettings).limit(1)
    if (row) {
      // L'adresse admin prime sur la variable d'env quand elle est renseignée.
      redirectEmail = row.redirectEmail ?? redirectEmail
      bypassRedirect = row.bypassRedirect
    }
  } catch {
    // Pas de base accessible : on s'en tient à la variable d'env.
  }

  return resolveDelivery({ appEnv: env.NEXT_PUBLIC_APP_ENV, category, recipients, redirectEmail, bypassRedirect })
}
