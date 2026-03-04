import { and, eq, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { getServerSession } from '~/auth'
import { EResidenceType } from '~/enums/residence-type'
import { ETargetAudience } from '~/enums/target-audience'
import { TAccomodationMy } from '~/schemas/accommodations/accommodations'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { owners } from '~/server/db/schema/owners'

const residenceTypeValues = new Set<string>(Object.values(EResidenceType))
const targetAudienceValues = new Set<string>(Object.values(ETargetAudience))

function toResidenceType(value: string | null): EResidenceType | null {
  return value && residenceTypeValues.has(value) ? (value as EResidenceType) : null
}

function toTargetAudience(value: string | null): ETargetAudience | null {
  return value && targetAudienceValues.has(value) ? (value as ETargetAudience) : null
}

export const getAccommodationMyById = async (slug: string): Promise<TAccomodationMy> => {
  const auth = await getServerSession()
  if (!auth) {
    return notFound()
  }

  const userId = auth.user.id

  const [owner] = await db.select().from(owners).where(eq(owners.userId, userId)).limit(1)
  if (!owner) {
    return notFound()
  }

  const rows = await db
    .select({
      id: accommodations.id,
      name: accommodations.name,
      slug: accommodations.slug,
      description: accommodations.description,
      address: accommodations.address,
      city: accommodations.city,
      postalCode: accommodations.postalCode,
      residenceType: accommodations.residenceType,
      targetAudience: accommodations.target_audience,
      published: accommodations.published,
      available: accommodations.available,
      nbTotalApartments: accommodations.nbTotalApartments,
      nbAccessibleApartments: accommodations.nbAccessibleApartments,
      nbColivingApartments: accommodations.nbColivingApartments,
      nbT1: accommodations.nbT1,
      nbT1Bis: accommodations.nbT1Bis,
      nbT2: accommodations.nbT2,
      nbT3: accommodations.nbT3,
      nbT4: accommodations.nbT4,
      nbT5: accommodations.nbT5,
      nbT6: accommodations.nbT6,
      nbT7More: accommodations.nbT7More,
      nbT1Available: accommodations.nbT1Available,
      nbT1BisAvailable: accommodations.nbT1BisAvailable,
      nbT2Available: accommodations.nbT2Available,
      nbT3Available: accommodations.nbT3Available,
      nbT4Available: accommodations.nbT4Available,
      nbT5Available: accommodations.nbT5Available,
      nbT6Available: accommodations.nbT6Available,
      nbT7MoreAvailable: accommodations.nbT7MoreAvailable,
      priceMin: accommodations.priceMin,
      priceMinT1: accommodations.priceMinT1,
      priceMaxT1: accommodations.priceMaxT1,
      priceMinT1Bis: accommodations.priceMinT1Bis,
      priceMaxT1Bis: accommodations.priceMaxT1Bis,
      priceMinT2: accommodations.priceMinT2,
      priceMaxT2: accommodations.priceMaxT2,
      priceMinT3: accommodations.priceMinT3,
      priceMaxT3: accommodations.priceMaxT3,
      priceMinT4: accommodations.priceMinT4,
      priceMaxT4: accommodations.priceMaxT4,
      priceMinT5: accommodations.priceMinT5,
      priceMaxT5: accommodations.priceMaxT5,
      priceMinT6: accommodations.priceMinT6,
      priceMaxT6: accommodations.priceMaxT6,
      priceMinT7More: accommodations.priceMinT7More,
      priceMaxT7More: accommodations.priceMaxT7More,
      acceptWaitingList: accommodations.acceptWaitingList,
      scholarshipHoldersPriority: accommodations.scholarshipHoldersPriority,
      wifi: accommodations.wifi,
      imagesUrls: accommodations.imagesUrls,
      externalUrl: accommodations.externalUrl,
      updatedAt: accommodations.updatedAt,
      laundryRoom: accommodations.laundryRoom,
      commonAreas: accommodations.commonAreas,
      bikeStorage: accommodations.bikeStorage,
      parking: accommodations.parking,
      secureAccess: accommodations.secureAccess,
      residenceManager: accommodations.residenceManager,
      kitchenType: accommodations.kitchenType,
      desk: accommodations.desk,
      cookingPlates: accommodations.cookingPlates,
      microwave: accommodations.microwave,
      refrigerator: accommodations.refrigerator,
      bathroom: accommodations.bathroom,
      ownerName: owners.name,
      ownerUrl: owners.url,
      lat: sql<number>`ST_Y(${accommodations.geom}::geometry)`,
      lng: sql<number>`ST_X(${accommodations.geom}::geometry)`,
    })
    .from(accommodations)
    .leftJoin(owners, eq(accommodations.ownerId, owners.id))
    .where(and(eq(accommodations.slug, slug), eq(accommodations.ownerId, owner.id)))
    .limit(1)

  const row = rows[0]
  if (!row) {
    return notFound()
  }

  const priceMaxes = [
    row.priceMaxT1,
    row.priceMaxT1Bis,
    row.priceMaxT2,
    row.priceMaxT3,
    row.priceMaxT4,
    row.priceMaxT5,
    row.priceMaxT6,
    row.priceMaxT7More,
  ].filter((v): v is number => v != null && v > 0)

  return {
    geometry: {
      type: 'Point',
      coordinates: [row.lng, row.lat],
    },
    properties: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? null,
      address: row.address ?? '',
      city: row.city,
      postal_code: row.postalCode,
      residence_type: toResidenceType(row.residenceType),
      target_audience: toTargetAudience(row.targetAudience),
      published: row.published,
      available: row.available,
      accept_waiting_list: row.acceptWaitingList ?? false,
      images_urls: row.imagesUrls ?? null,
      external_url: row.externalUrl ?? undefined,
      updated_at: row.updatedAt ?? new Date(),
      scholarship_holders_priority: row.scholarshipHoldersPriority ?? false,
      wifi: row.wifi ?? false,
      nb_total_apartments: row.nbTotalApartments,
      nb_accessible_apartments: row.nbAccessibleApartments,
      nb_coliving_apartments: row.nbColivingApartments,
      nb_t1: row.nbT1,
      nb_t1_bis: row.nbT1Bis,
      nb_t2: row.nbT2,
      nb_t3: row.nbT3,
      nb_t4: row.nbT4,
      nb_t5: row.nbT5,
      nb_t6: row.nbT6,
      nb_t7_more: row.nbT7More,
      nb_t1_available: row.nbT1Available,
      nb_t1_bis_available: row.nbT1BisAvailable,
      nb_t2_available: row.nbT2Available,
      nb_t3_available: row.nbT3Available,
      nb_t4_available: row.nbT4Available,
      nb_t5_available: row.nbT5Available,
      nb_t6_available: row.nbT6Available,
      nb_t7_more_available: row.nbT7MoreAvailable,
      price_min: row.priceMin,
      price_min_t1: row.priceMinT1,
      price_min_t1_bis: row.priceMinT1Bis,
      price_min_t2: row.priceMinT2,
      price_min_t3: row.priceMinT3,
      price_min_t4: row.priceMinT4,
      price_min_t5: row.priceMinT5,
      price_min_t6: row.priceMinT6,
      price_min_t7_more: row.priceMinT7More,
      price_max: priceMaxes.length > 0 ? Math.max(...priceMaxes) : null,
      price_max_t1: row.priceMaxT1,
      price_max_t1_bis: row.priceMaxT1Bis,
      price_max_t2: row.priceMaxT2,
      price_max_t3: row.priceMaxT3,
      price_max_t4: row.priceMaxT4,
      price_max_t5: row.priceMaxT5,
      price_max_t6: row.priceMaxT6,
      price_max_t7_more: row.priceMaxT7More,
      owner_name: row.ownerName ?? null,
      owner_url: row.ownerUrl ?? null,
      refrigerator: row.refrigerator ?? null,
      laundry_room: row.laundryRoom ?? null,
      bathroom: row.bathroom as 'private' | 'shared' | null,
      kitchen_type: row.kitchenType as 'private' | 'shared' | null,
      microwave: row.microwave ?? null,
      secure_access: row.secureAccess ?? null,
      parking: row.parking ?? null,
      common_areas: row.commonAreas ?? null,
      bike_storage: row.bikeStorage ?? null,
      desk: row.desk ?? null,
      residence_manager: row.residenceManager ?? null,
      cooking_plates: row.cookingPlates ?? null,
    },
  }
}
