import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { APARTMENT_TYPES } from '~/enums/apartment-type'
import { DF_TENANT_STATUSES_BLOCKING_APPLICATION, type DFTenantStatus } from '~/enums/dossier-facile-tenant-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { db } from '~/server/db'
import { accommodations, accommodationTypologies, dossierFacileApplications, dossierFacileTenants, owners } from '~/server/db/schema'
import { ensureFavorite } from '~/server/favorites/ensure-favorite'
import { buildDossierFacileAuthorizationUrl, validateDossierFacileConfig } from '~/server/services/dossier-facile/sync'
import { getJwtSecret } from '~/server/utils/jwt-secret'
import { createTRPCRouter, userProcedure } from '../init'

const STATE_COOKIE_NAME = 'df_oauth_state'
const STATE_TTL_SECONDS = 600 // 10 minutes

export const dossierFacileRouter = createTRPCRouter({
  connectUrl: userProcedure
    .input(z.object({ returnTo: z.string().startsWith('/').optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== 'user') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only students can connect DossierFacile' })
      }

      validateDossierFacileConfig()

      const state = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + STATE_TTL_SECONDS * 1000)

      const token = await new SignJWT({ state, userId: ctx.session.user.id, returnTo: input?.returnTo })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(expiresAt)
        .setIssuedAt()
        .sign(getJwtSecret())

      const cookieStore = await cookies()
      cookieStore.set(STATE_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: STATE_TTL_SECONDS,
      })

      const authorizationUrl = buildDossierFacileAuthorizationUrl(state, ctx.session.user.email)

      return { authorizationUrl, expiresAt: expiresAt.toISOString() }
    }),

  /**
   * Délie le compte DossierFacile de l'étudiant.
   *
   * La suppression de la ligne locataire emporte, par cascade, ses documents en cache **et** ses
   * candidatures : c'est le point — retirer son dossier coupe l'accès des gestionnaires dans la
   * seconde, sans attendre le cron de purge. Idempotent : aucun compte lié n'est pas une erreur.
   */
  disconnect: userProcedure.mutation(async ({ ctx }) => {
    const deleted = await db
      .delete(dossierFacileTenants)
      .where(eq(dossierFacileTenants.userId, ctx.session.user.id))
      .returning({ id: dossierFacileTenants.id })

    return { disconnected: deleted.length > 0 }
  }),

  tenant: userProcedure.query(async ({ ctx }) => {
    const tenant = await db.query.dossierFacileTenants.findFirst({
      where: eq(dossierFacileTenants.userId, ctx.session.user.id),
    })
    return tenant ?? null
  }),

  listApplications: userProcedure.input(z.object({ accommodationSlug: z.string() })).query(async ({ ctx, input }) => {
    const tenant = await db.query.dossierFacileTenants.findFirst({
      where: eq(dossierFacileTenants.userId, ctx.session.user.id),
    })
    if (!tenant) return null

    const application = await db.query.dossierFacileApplications.findFirst({
      where: and(
        eq(dossierFacileApplications.tenantId, tenant.id),
        eq(dossierFacileApplications.accommodationSlug, input.accommodationSlug),
      ),
    })
    return application ?? null
  }),

  application: userProcedure
    .input(
      z.object({
        accommodationSlug: z.string(),
        apartmentType: z.enum(APARTMENT_TYPES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await db.query.dossierFacileTenants.findFirst({
        where: eq(dossierFacileTenants.userId, ctx.session.user.id),
      })
      if (!tenant) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No DossierFacile tenant linked' })
      }
      // Le dossier n'a pas besoin d'être validé pour candidater : la candidature reste masquée
      // du board gestionnaire tant que DossierFacile ne l'a pas validée (cf. bailleur router).
      if (DF_TENANT_STATUSES_BLOCKING_APPLICATION.includes(tenant.status as DFTenantStatus)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'DossierFacile access is revoked' })
      }

      const accommodation = await db.query.accommodations.findFirst({
        where: and(eq(accommodations.slug, input.accommodationSlug), eq(accommodations.published, true)),
      })
      if (!accommodation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Accommodation not found' })
      }

      const owner = accommodation.ownerId
        ? await db.query.owners.findFirst({ where: eq(owners.id, accommodation.ownerId), columns: { contactMode: true } })
        : null
      if (owner?.contactMode !== EOwnerContactMode.DOSSIER_FACILE) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: "Ce gestionnaire n'accepte pas les candidatures DossierFacile" })
      }

      if (!accommodation.acceptsApplications) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: "Cette résidence n'accepte pas les candidatures" })
      }

      const [typology] = await db
        .select({ nbAvailable: accommodationTypologies.nbAvailable })
        .from(accommodationTypologies)
        .where(and(eq(accommodationTypologies.accommodationId, accommodation.id), eq(accommodationTypologies.type, input.apartmentType)))
        .limit(1)
      const availableCount = typology?.nbAvailable
      if (!availableCount || availableCount <= 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This apartment type is not available' })
      }

      const [application] = await db
        .insert(dossierFacileApplications)
        .values({
          tenantId: tenant.id,
          accommodationSlug: input.accommodationSlug,
          apartmentType: input.apartmentType,
        })
        .onConflictDoNothing()
        .returning()

      // Candidater vaut suivi : la résidence rejoint les favoris, où la candidature est restituée.
      await ensureFavorite(ctx.session.user.id, accommodation.id)

      return application ?? null
    }),
})
