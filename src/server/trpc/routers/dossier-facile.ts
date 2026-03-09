import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { APARTMENT_TYPES } from '~/enums/apartment-type'
import { db } from '~/server/db'
import { accommodations, dossierFacileApplications, dossierFacileTenants } from '~/server/db/schema'
import { buildAuthorizationUrl, validateConfig } from '~/server/services/dossier-facile'
import { createTRPCRouter, protectedProcedure } from '../init'

const STATE_COOKIE_NAME = 'df_oauth_state'
const STATE_TTL_SECONDS = 600 // 10 minutes

function getJwtSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(secret)
}

type ApartmentType = (typeof APARTMENT_TYPES)[number]

const availabilityKey: Record<
  ApartmentType,
  | 'nbT1Available'
  | 'nbT1BisAvailable'
  | 'nbT2Available'
  | 'nbT3Available'
  | 'nbT4Available'
  | 'nbT5Available'
  | 'nbT6Available'
  | 'nbT7MoreAvailable'
> = {
  t1: 'nbT1Available',
  t1_bis: 'nbT1BisAvailable',
  t2: 'nbT2Available',
  t3: 'nbT3Available',
  t4: 'nbT4Available',
  t5: 'nbT5Available',
  t6: 'nbT6Available',
  t7_more: 'nbT7MoreAvailable',
}

export const dossierFacileRouter = createTRPCRouter({
  connectUrl: protectedProcedure.input(z.object({ returnTo: z.url().optional() }).optional()).mutation(async ({ ctx, input }) => {
    if (ctx.session.user.role !== 'user') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only students can connect DossierFacile' })
    }

    validateConfig()

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

    const authorizationUrl = buildAuthorizationUrl(state, ctx.session.user.email)

    return { authorizationUrl, expiresAt: expiresAt.toISOString() }
  }),

  tenant: protectedProcedure.query(async ({ ctx }) => {
    const tenant = await db.query.dossierFacileTenants.findFirst({
      where: eq(dossierFacileTenants.userId, ctx.session.user.id),
    })
    return tenant ?? null
  }),

  listApplications: protectedProcedure.input(z.object({ accommodationSlug: z.string() })).query(async ({ ctx, input }) => {
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

  application: protectedProcedure
    .input(
      z.object({
        accommodationSlug: z.string(),
        apartmentType: z.enum(APARTMENT_TYPES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== 'user') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only students can apply' })
      }

      const tenant = await db.query.dossierFacileTenants.findFirst({
        where: eq(dossierFacileTenants.userId, ctx.session.user.id),
      })
      if (!tenant) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No DossierFacile tenant linked' })
      }
      if (tenant.status !== 'verified') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant dossier is not verified' })
      }

      const accommodation = await db.query.accommodations.findFirst({
        where: eq(accommodations.slug, input.accommodationSlug),
      })
      if (!accommodation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Accommodation not found' })
      }

      const key = availabilityKey[input.apartmentType]
      const availableCount = accommodation[key]
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

      return application ?? null
    }),
})
