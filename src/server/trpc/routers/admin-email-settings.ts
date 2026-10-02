import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { db } from '~/server/db'
import { emailInterceptionSettings } from '~/server/db/schema'
import { env } from '~/server/env'
import { logActivity } from '~/server/services/activity-logger'
import { adminProcedure, createTRPCRouter } from '../init'

// Clé fixe de la ligne singleton (cf. schéma email-interception-settings).
const SINGLETON_ID = 'SINGLETON'

/**
 * Réglages d'interception des emails hors production (ADR 0003). La fonctionnalité n'existe
 * qu'en dehors de la production : toute lecture/écriture est refusée en prod (verrou API).
 */
const assertNotProduction = () => {
  if (env.NEXT_PUBLIC_APP_ENV === 'production') {
    throw new TRPCError({ code: 'FORBIDDEN', message: "L'interception des emails n'est pas disponible en production." })
  }
}

export const adminEmailSettingsRouter = createTRPCRouter({
  get: adminProcedure.query(async () => {
    assertNotProduction()

    const [row] = await db.select().from(emailInterceptionSettings).limit(1)

    return {
      redirectEmail: row?.redirectEmail ?? null,
      bypassRedirect: row?.bypassRedirect ?? false,
      updatedAt: row?.updatedAt ?? null,
      // Repli utilisé quand aucune adresse n'est configurée ici (variable d'env locale/CI).
      envFallback: env.STAGING_EMAIL_REDIRECT ?? null,
    }
  }),

  update: adminProcedure
    .input(
      z.object({
        redirectEmail: z
          .union([z.email({ message: 'Veuillez saisir une adresse email valide' }), z.literal('')])
          .nullable()
          .transform((value) => value || null),
        bypassRedirect: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertNotProduction()

      const [row] = await db
        .insert(emailInterceptionSettings)
        .values({
          id: SINGLETON_ID,
          redirectEmail: input.redirectEmail,
          bypassRedirect: input.bypassRedirect,
          updatedBy: ctx.session.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: emailInterceptionSettings.id,
          set: {
            redirectEmail: input.redirectEmail,
            bypassRedirect: input.bypassRedirect,
            updatedBy: ctx.session.user.id,
            updatedAt: new Date(),
          },
        })
        .returning()

      await logActivity({
        userId: ctx.session.user.id,
        userName: ctx.session.user.email,
        action: 'update',
        entityType: 'email_interception_settings',
        entityId: SINGLETON_ID,
        metadata: { redirectEmail: input.redirectEmail, bypassRedirect: input.bypassRedirect },
      })

      return row
    }),
})
