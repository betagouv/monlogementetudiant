import { and, eq, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { EResidenceType } from '~/enums/residence-type'
import { ETargetAudience } from '~/enums/target-audience'
import { TAccomodationMy } from '~/schemas/accommodations/accommodations'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { user } from '~/server/db/schema/auth'
import { getServerSession } from '~/services/better-auth'

const residenceTypeValues = new Set<string>(Object.values(EResidenceType))
const targetAudienceValues = new Set<string>(Object.values(ETargetAudience))

function toResidenceType(value: string | null): EResidenceType | null {
  return value && residenceTypeValues.has(value) ? (value as EResidenceType) : null
}

function toTargetAudience(value: string | null): ETargetAudience | null {
  return value && targetAudienceValues.has(value) ? (value as ETargetAudience) : null
}

function computePriceMax(
  row: Pick<
    typeof accommodations.$inferSelect,
    'priceMaxT1' | 'priceMaxT1Bis' | 'priceMaxT2' | 'priceMaxT3' | 'priceMaxT4' | 'priceMaxT5' | 'priceMaxT6' | 'priceMaxT7More'
  >,
): number | null {
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

  return priceMaxes.length > 0 ? Math.max(...priceMaxes) : null
}

type AccommodationWithOwnerAndExtras = Omit<typeof accommodations.$inferSelect, 'geom'> & {
  owner: { name: string; url: string | null } | null
  lat: number
  lng: number
}

function mapToAccommodationMy(row: AccommodationWithOwnerAndExtras): TAccomodationMy {
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
      target_audience: toTargetAudience(row.target_audience),
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
      price_max: computePriceMax(row),
      price_max_t1: row.priceMaxT1,
      price_max_t1_bis: row.priceMaxT1Bis,
      price_max_t2: row.priceMaxT2,
      price_max_t3: row.priceMaxT3,
      price_max_t4: row.priceMaxT4,
      price_max_t5: row.priceMaxT5,
      price_max_t6: row.priceMaxT6,
      price_max_t7_more: row.priceMaxT7More,
      superficie_min_t1: row.superficieMinT1,
      superficie_max_t1: row.superficieMaxT1,
      superficie_min_t1_bis: row.superficieMinT1Bis,
      superficie_max_t1_bis: row.superficieMaxT1Bis,
      superficie_min_t2: row.superficieMinT2,
      superficie_max_t2: row.superficieMaxT2,
      superficie_min_t3: row.superficieMinT3,
      superficie_max_t3: row.superficieMaxT3,
      superficie_min_t4: row.superficieMinT4,
      superficie_max_t4: row.superficieMaxT4,
      superficie_min_t5: row.superficieMinT5,
      superficie_max_t5: row.superficieMaxT5,
      superficie_min_t6: row.superficieMinT6,
      superficie_max_t6: row.superficieMaxT6,
      superficie_min_t7_more: row.superficieMinT7More,
      superficie_max_t7_more: row.superficieMaxT7More,
      owner_name: row.owner?.name ?? null,
      owner_url: row.owner?.url ?? null,
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

export const getAccommodationMyById = async (slug: string): Promise<TAccomodationMy> => {
  const auth = await getServerSession()
  if (!auth) {
    return notFound()
  }

  let ownerId: number | null = null
  if (auth.user.role !== 'admin') {
    const userId = auth.user.id
    const usr = await db.query.user.findFirst({ where: eq(user.id, userId), with: { owner: true } })
    const owner = usr?.owner
    if (!owner) {
      return notFound()
    }
    ownerId = owner.id
  }

  const row = await db.query.accommodations.findFirst({
    where: ownerId != null ? and(eq(accommodations.slug, slug), eq(accommodations.ownerId, ownerId)) : eq(accommodations.slug, slug),
    columns: { geom: false },
    with: { owner: true },
    extras: {
      lat: sql<number>`ST_Y(${accommodations.geom}::geometry)`.as('lat'),
      lng: sql<number>`ST_X(${accommodations.geom}::geometry)`.as('lng'),
    },
  })

  if (!row) {
    return notFound()
  }

  return mapToAccommodationMy(row)
}
