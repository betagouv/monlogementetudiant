'use server'

import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { db } from '~/server/db'
import { user } from '~/server/db/schema'
import { auth } from '~/services/better-auth'

/**
 * Sans `errorCallbackURL`, un lien expiré ou déjà consommé retombe sur la `callbackURL` de succès,
 * où l'absence de session est mal interprétée : 404 muet côté gestionnaire, retour au formulaire de
 * connexion sans le moindre message côté administration.
 */
const ERROR_CALLBACK_URL_BY_ROLE = {
  owner: '/verification/erreur?role=owner',
  admin: '/verification/erreur?role=admin',
} as const

export async function sendMagicLink(email: string, role: 'owner' | 'admin', callbackURL?: string) {
  const result = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.email, email), eq(user.role, role)))
    .limit(1)

  if (result.length > 0) {
    const requestHeaders = await headers()
    const errorCallbackURL = ERROR_CALLBACK_URL_BY_ROLE[role]
    await auth.api.signInMagicLink({ body: { email, callbackURL, errorCallbackURL }, headers: requestHeaders })
  }

  return { success: true }
}
