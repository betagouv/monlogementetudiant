import { and, eq, sql } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { EResidenceType } from '~/enums/residence-type'
import { ETargetAudience } from '~/enums/target-audience'
import { TAccomodationMy } from '~/schemas/accommodations/accommodations'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { user } from '~/server/db/schema/auth'
import { cities } from '~/server/db/schema/cities'
import { externalSources } from '~/server/db/schema/external-sources'
import { typologiesByType } from '~/server/lib/typologies'
import { getServerSession } from '~/services/better-auth'
import { type BailleurPermission, type BailleurRole, hasPermission } from './permissions'

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

  // Même garde que la liste des résidences : la fiche complète n'est visible que des comptes
  // autorisés à gérer les résidences (les mutations, elles, sont gardées par tRPC).
  const canManageResidences = hasPermission(
    {
      role: auth.user.role,
      bailleurRole: (auth.user.bailleurRole as BailleurRole | null) ?? null,
      bailleurPermissions: (auth.user.bailleurPermissions as BailleurPermission[]) ?? [],
    },
    'manage_residences',
  )
  if (!canManageResidences) {
    return redirect('/bailleur/tableau-de-bord')
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
    with: { owner: true, typologies: true },
  })

  if (!row) {
    return notFound()
  }

  const typologies = typologiesByType(row.typologies)

  // Fetch addresses separately to avoid geometry deserialization issues
  const addresses = await db
    .select({
      id: accommodationAddresses.id,
      address: accommodationAddresses.address,
      postalCode: accommodationAddresses.postalCode,
      isMain: accommodationAddresses.isMain,
      cityName: cities.name,
      lat: sql<number>`ST_Y(${accommodationAddresses.geom}::geometry)`,
      lng: sql<number>`ST_X(${accommodationAddresses.geom}::geometry)`,
    })
    .from(accommodationAddresses)
    .innerJoin(cities, eq(accommodationAddresses.cityId, cities.id))
    .where(eq(accommodationAddresses.accommodationId, row.id))
    .orderBy(sql`${accommodationAddresses.isMain} DESC`)

  const hasExternalSource = await db.query.externalSources.findFirst({
    where: eq(externalSources.accommodationId, row.id),
  })

  const mainAddress = addresses.find((a) => a.isMain) ?? addresses[0]
  const lat = mainAddress?.lat ?? 0
  const lng = mainAddress?.lng ?? 0

  const allAddresses = addresses.map((a) => ({
    address: a.address ?? '',
    city: a.cityName,
    postalCode: a.postalCode,
    isMain: a.isMain,
  }))

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    rentalChargesDetails: row.rentalChargesDetails ?? null,
    address: mainAddress?.address ?? '',
    city: mainAddress?.cityName ?? '',
    postalCode: mainAddress?.postalCode ?? '',
    addresses: allAddresses,
    latitude: lat,
    longitude: lng,
    residenceType: toResidenceType(row.residenceType),
    targetAudience: toTargetAudience(row.targetAudience),
    published: row.published,
    acceptWaitingList: row.acceptWaitingList ?? false,
    acceptsApplications: row.acceptsApplications ?? true,
    imagesUrls: row.imagesUrls ?? null,
    externalUrl: row.externalUrl ?? undefined,
    virtualTourUrl: row.virtualTourUrl ?? null,
    updatedAt: row.updatedAt ?? new Date(),
    scholarshipHoldersPriority: row.scholarshipHoldersPriority ?? false,
    socialHousingRequired: row.socialHousingRequired ?? false,
    wifi: row.wifi ?? false,
    nbTotalApartments: row.nbTotalApartments,
    nbAccessibleApartments: row.nbAccessibleApartments,
    nbColivingApartments: row.nbColivingApartments,
    priceMin: row.priceMin,
    priceMax: row.priceMax,
    ownerName: row.owner?.name ?? null,
    ownerUrl: row.owner?.url ?? null,
    typologies,
    refrigerator: row.refrigerator ?? null,
    laundryRoom: row.laundryRoom ?? null,
    bathroom: row.bathroom as 'private' | 'shared' | null,
    kitchenType: row.kitchenType as 'private' | 'shared' | null,
    microwave: row.microwave ?? null,
    secureAccess: row.secureAccess ?? null,
    parking: row.parking ?? null,
    commonAreas: row.commonAreas ?? null,
    bikeStorage: row.bikeStorage ?? null,
    desk: row.desk ?? null,
    residenceManager: row.residenceManager ?? null,
    cookingPlates: row.cookingPlates ?? null,
    isImported: !!hasExternalSource,
  }
}
