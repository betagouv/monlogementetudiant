import { TRPCError } from '@trpc/server'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { ZCreateResidence } from '~/schemas/accommodations/create-residence'
import { getOwnerForUser } from '~/server/bailleur/get-owner-for-user'
import { storeResidenceImages } from '~/server/bailleur/residence-images'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { persistTypologies, typologyAggregates, typologyDraft } from '~/server/lib/typologies'
import { logActivity } from '~/server/services/activity-logger'
import { triggerAlertDetection } from '~/server/services/alert-detection-trigger'
import { generateSlug, geocodeAddress } from '~/server/trpc/utils/accommodation-helpers'
import { resolveCityId } from '~/server/trpc/utils/resolve-city'
import { findAvailableSlug } from '~/server/utils/slug'
import { normalizeAccommodationName } from '~/utils/normalize-accommodation-name'
import { sanitizeHTML } from '~/utils/sanitize-html'

export const ZCreateResidenceInput = ZCreateResidence.omit({ imagesFiles: true, imagesUrls: true }).extend({
  name: z.string().min(1, 'Le nom de la résidence est requis'),
  ownerId: z.number().int().positive().optional(),
})

export type TCreateResidenceInput = z.infer<typeof ZCreateResidenceInput>

export function sanitizeSection(html: string | undefined): string | null {
  return html ? sanitizeHTML(html) || null : null
}

export async function createResidence(
  author: { id: string; name: string },
  input: TCreateResidenceInput,
  images: File[] = [],
): Promise<{ slug: string }> {
  const owner = await getOwnerForUser(author.id, input.ownerId)
  if (!owner) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'No owner record for this user' })
  }

  const { typologies, name, addresses, ownerId: _ownerId, ...fields } = input

  const slug = await findAvailableSlug(generateSlug(name), db, accommodations)
  const aggregates = typologyAggregates(typologies)

  const resolvedAddresses = await Promise.all(
    addresses.map(async (addr, i) => {
      const [coords, cityId] = await Promise.all([
        geocodeAddress(addr.address, addr.city, addr.postalCode),
        resolveCityId(addr.postalCode, addr.city),
      ])
      return {
        isMain: i === 0,
        address: addr.address,
        postalCode: addr.postalCode,
        cityId,
        geom: coords ? sql`ST_SetSRID(ST_MakePoint(${coords.lon}, ${coords.lat}), 4326)` : undefined,
      }
    }),
  )

  const insert = (imagesUrls: string[]) =>
    db.transaction(async (tx) => {
      const [row] = await tx
        .insert(accommodations)
        .values({
          name: normalizeAccommodationName(name),
          slug,
          residenceType: fields.residenceType ?? null,
          targetAudience: fields.targetAudience ?? null,
          description: fields.description ? sanitizeHTML(fields.description) : null,
          tagline: fields.tagline?.trim() || null,
          locationAndProximity: sanitizeSection(fields.locationAndProximity),
          servicesAndEquipment: sanitizeSection(fields.servicesAndEquipment),
          receptionAndContact: sanitizeSection(fields.receptionAndContact),
          practicalInfo: sanitizeSection(fields.practicalInfo),
          otherInformation: sanitizeSection(fields.otherInformation),
          rentalChargesDetails: fields.rentalChargesDetails ?? null,
          externalUrl: fields.externalUrl || null,
          virtualTourUrl: fields.virtualTourUrl?.trim() || null,
          phoneNumber: fields.phoneNumber ?? null,
          acceptWaitingList: fields.acceptWaitingList ?? false,
          published: fields.published ?? false,
          scholarshipHoldersPriority: fields.scholarshipHoldersPriority ?? false,
          socialHousingRequired: fields.socialHousingRequired ?? false,
          ownerId: owner.id,
          nbTotalApartments: aggregates.nbTotalApartments,
          priceMin: aggregates.priceMin,
          priceMax: aggregates.priceMax,
          nbAvailableApartments: aggregates.nbAvailableApartments,
          imagesUrls,
          nbAccessibleApartments: fields.nbAccessibleApartments ?? 0,
          nbColivingApartments: fields.nbColivingApartments ?? 0,
          refrigerator: fields.refrigerator ?? null,
          laundryRoom: fields.laundryRoom ?? null,
          bathroom: fields.bathroom ?? null,
          kitchenType: fields.kitchenType ?? null,
          microwave: fields.microwave ?? null,
          secureAccess: fields.secureAccess ?? null,
          parking: fields.parking ?? null,
          commonAreas: fields.commonAreas ?? null,
          bikeStorage: fields.bikeStorage ?? null,
          desk: fields.desk ?? null,
          residenceManager: fields.residenceManager ?? null,
          cookingPlates: fields.cookingPlates ?? null,
          wifi: fields.wifi ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: accommodations.id, slug: accommodations.slug, name: accommodations.name })
      await persistTypologies(
        tx,
        row.id,
        typologies.map((t) => typologyDraft(t.type, t)),
        { updatedBy: author.id },
      )
      await tx.insert(accommodationAddresses).values(resolvedAddresses.map((addr) => ({ ...addr, accommodationId: row.id })))
      return row
    })

  const created = images.length > 0 ? await storeResidenceImages(images, insert) : await insert([])

  await logActivity({
    userId: author.id,
    userName: author.name,
    action: 'accommodation.created',
    entityType: 'accommodation',
    entityName: created.name,
    ownerId: owner.id,
    ownerName: owner.name,
    metadata: { slug: created.slug },
  })

  await triggerAlertDetection([created.id])

  return { slug: created.slug }
}
