import * as Sentry from '@sentry/nextjs'
import { TRPCError } from '@trpc/server'
import { and, eq, gte } from 'drizzle-orm'
import { z } from 'zod'
import { APARTMENT_TYPES } from '~/enums/apartment-type'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { ZBirthDate, ZScholarshipStatus } from '~/schemas/student-profile/student-profile'
import { contactRetentionCutoff } from '~/server/candidatures/visibility'
import { createClaimToken } from '~/server/contacts/claim-token'
import { assertContactRequestRateLimit, hashIp } from '~/server/contacts/rate-limit'
import { db } from '~/server/db'
import { accommodations, contactRequests, owners } from '~/server/db/schema'
import { env } from '~/server/env'
import { ensureFavorite } from '~/server/favorites/ensure-favorite'
import { sendContactRequestConfirmationEmail } from '~/server/services/brevo'
import { baseProcedure, createTRPCRouter, userProcedure } from '../init'

/** Lien de double opt-in envoyé au visiteur. */
const buildConfirmationUrl = (contactRequestId: string) =>
  `${env.BASE_URL}/api/contacts/confirmer?token=${encodeURIComponent(createClaimToken(contactRequestId, 'confirm'))}`

/** Résout une résidence par son slug (le slug reste l'identifiant public des URLs). */
const findAccommodationBySlug = async (slug: string) => {
  const [accommodation] = await db
    .select({
      id: accommodations.id,
      name: accommodations.name,
      ownerId: accommodations.ownerId,
      nbAvailableApartments: accommodations.nbAvailableApartments,
    })
    .from(accommodations)
    .where(eq(accommodations.slug, slug))
    .limit(1)

  if (!accommodation) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Accommodation not found' })
  }

  return accommodation
}

export const contactsRouter = createTRPCRouter({
  /** Le student courant a-t-il déjà laissé ses coordonnées sur cette résidence ? */
  myRequest: userProcedure.input(z.object({ accommodationSlug: z.string() })).query(async ({ ctx, input }) => {
    const accommodation = await findAccommodationBySlug(input.accommodationSlug)

    // Même fenêtre que côté gestionnaire : une demande sortie de rétention ne doit pas continuer à
    // bloquer le bouton de l'étudiant sur un « Coordonnées transmises » que plus personne ne voit.
    const request = await db.query.contactRequests.findFirst({
      where: and(
        eq(contactRequests.userId, ctx.session.user.id),
        eq(contactRequests.accommodationId, accommodation.id),
        gte(contactRequests.createdAt, contactRetentionCutoff()),
      ),
    })
    return request ?? null
  }),

  /** Laisser ses coordonnées (mode `contacts` du gestionnaire). */
  create: baseProcedure
    .input(
      z.object({
        accommodationSlug: z.string(),
        firstname: z.string().trim().min(1),
        lastname: z.string().trim().min(1),
        email: z
          .string()
          .trim()
          .email()
          .transform((email) => email.toLowerCase()),
        phone: z.string().trim().optional(),
        birthdate: ZBirthDate,
        scholarshipStatus: ZScholarshipStatus,
        apartmentType: z.enum(APARTMENT_TYPES).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.session?.user.role && ctx.session.user.role !== 'user') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Student role required' })
      }

      const accommodation = await findAccommodationBySlug(input.accommodationSlug)

      const owner = accommodation.ownerId
        ? await db.query.owners.findFirst({ where: eq(owners.id, accommodation.ownerId), columns: { contactMode: true } })
        : null

      if (owner?.contactMode !== EOwnerContactMode.CONTACTS) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: "Ce gestionnaire n'accepte pas les demandes de contact" })
      }

      if (!accommodation.nbAvailableApartments || accommodation.nbAvailableApartments <= 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: "Ce logement n'a pas de disponibilités" })
      }

      const ipHash = hashIp(ctx.clientIp)
      await assertContactRequestRateLimit(ipHash)

      const userId = ctx.session?.user.id ?? null

      const [request] = await db
        .insert(contactRequests)
        .values({
          userId,
          accommodationId: accommodation.id,
          firstname: input.firstname,
          lastname: input.lastname,
          email: input.email,
          phone: input.phone || null,
          birthdate: input.birthdate,
          scholarshipStatus: input.scholarshipStatus,
          apartmentType: input.apartmentType ?? null,
          ipHash,
          // Étudiant connecté : Better Auth a déjà prouvé l'adresse, pas de double opt-in à demander.
          confirmedAt: userId ? new Date() : null,
        })
        .onConflictDoNothing()
        .returning()

      if (!request) return null

      if (request.userId) {
        // Candidater vaut suivi : la résidence rejoint les favoris, où la candidature est restituée.
        await ensureFavorite(request.userId, accommodation.id)
        return { ...request, claimToken: null }
      }

      // Visiteur : ses coordonnées ne partiront chez le gestionnaire qu'une fois l'adresse confirmée.
      try {
        await sendContactRequestConfirmationEmail(request.email!, {
          url: buildConfirmationUrl(request.id),
          accommodationName: accommodation.name,
        })
      } catch (error) {
        // Sans e-mail, la demande resterait invisible pour toujours et l'index unique
        // (accommodation, email) empêcherait toute nouvelle tentative : on annule l'insertion.
        await db.delete(contactRequests).where(eq(contactRequests.id, request.id))
        Sentry.captureException(error, { tags: { step: 'sendContactRequestConfirmationEmail' } })
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: "L'e-mail de confirmation n'a pas pu être envoyé" })
      }

      // Le jeton préremplira le formulaire d'inscription depuis l'écran de succès.
      return { ...request, claimToken: createClaimToken(request.id) }
    }),
})
