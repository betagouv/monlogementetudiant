import { and, eq, inArray } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { TYPOLOGIES } from '~/schemas/accommodations/typology'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { departments } from '~/server/db/schema/departments'
import { owners } from '~/server/db/schema/owners'
import { typologiesByType } from '~/server/lib/typologies'
import { getServerSession } from '~/services/better-auth'
import { calculateAvailability } from '~/utils/calculateAvailability'
import { type TCsvColumn, toCsv } from '~/utils/csv'
import { getRegionByDepartmentCode } from '~/utils/french-regions'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session || session.user.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 })
  }

  const ownerIdParam = request.nextUrl.searchParams.get('ownerId')
  const ownerId = ownerIdParam ? Number(ownerIdParam) : undefined
  const where = ownerId ? and(eq(accommodations.ownerId, ownerId)) : undefined

  const filenameOwner = ownerId
    ? (await db.select({ name: owners.name }).from(owners).where(eq(owners.id, ownerId)).limit(1))[0]?.name
    : null
  const filenameSuffix = filenameOwner ? `-${filenameOwner.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}` : '-export'

  const results = await db
    .select({
      id: accommodations.id,
      name: accommodations.name,
      slug: accommodations.slug,
      description: accommodations.description,
      address: accommodationAddresses.address,
      postalCode: accommodationAddresses.postalCode,
      residenceType: accommodations.residenceType,
      targetAudience: accommodations.targetAudience,
      published: accommodations.published,
      city: cities.name,
      departmentCode: departments.code,
      departmentName: departments.name,
      ownerName: owners.name,
      nbTotalApartments: accommodations.nbTotalApartments,
      nbAccessibleApartments: accommodations.nbAccessibleApartments,
      nbColivingApartments: accommodations.nbColivingApartments,
      priceMin: accommodations.priceMin,
      priceMax: accommodations.priceMax,
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
      wifi: accommodations.wifi,
      bathroom: accommodations.bathroom,
      acceptWaitingList: accommodations.acceptWaitingList,
      scholarshipHoldersPriority: accommodations.scholarshipHoldersPriority,
      socialHousingRequired: accommodations.socialHousingRequired,
      externalUrl: accommodations.externalUrl,
      virtualTourUrl: accommodations.virtualTourUrl,
      externalReference: accommodations.externalReference,
      createdAt: accommodations.createdAt,
      updatedAt: accommodations.updatedAt,
    })
    .from(accommodations)
    .leftJoin(owners, eq(accommodations.ownerId, owners.id))
    .leftJoin(
      accommodationAddresses,
      and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
    )
    .leftJoin(cities, eq(accommodationAddresses.cityId, cities.id))
    .leftJoin(departments, eq(cities.departmentId, departments.id))
    .where(where)
    .orderBy(accommodations.name)

  const accIds = results.map((r) => r.id)
  const typologyRows =
    accIds.length > 0 ? await db.select().from(accommodationTypologies).where(inArray(accommodationTypologies.accommodationId, accIds)) : []
  const typologiesByAccommodation = new Map<number, (typeof typologyRows)[number][]>()
  for (const tRow of typologyRows) {
    const list = typologiesByAccommodation.get(tRow.accommodationId) ?? []
    list.push(tRow)
    typologiesByAccommodation.set(tRow.accommodationId, list)
  }

  const enriched = results.map((rawRow) => {
    const byType = typologiesByType(typologiesByAccommodation.get(rawRow.id) ?? [])
    // Flatten typologies back into per-typology columns for the CSV (admins expect flat columns).
    const flat: Record<string, number | null> = {}
    for (const { type } of TYPOLOGIES) {
      const t = byType[type]
      flat[`nb_${type}`] = t?.nbTotal ?? null
      flat[`nb_${type}_available`] = t?.nbAvailable ?? null
      flat[`price_min_${type}`] = t?.priceMin ?? null
      flat[`price_max_${type}`] = t?.priceMax ?? null
      flat[`superficie_min_${type}`] = t?.superficieMin ?? null
      flat[`superficie_max_${type}`] = t?.superficieMax ?? null
    }
    const nbLogementsDisponibles = calculateAvailability(byType)
    const region = getRegionByDepartmentCode(rawRow.departmentCode)
    return { ...rawRow, ...flat, region, disponibiliteRenseignee: nbLogementsDisponibles != null, nbLogementsDisponibles }
  })

  // region est calculée hors select : on la replace juste après departmentName pour regrouper les colonnes territoire
  const keys = enriched[0] ? Object.keys(enriched[0]).filter((h) => h !== 'region') : []
  const deptIndex = keys.indexOf('departmentName')
  if (deptIndex !== -1) keys.splice(deptIndex + 1, 0, 'region')

  // L'en-tête reprend le nom de la clé : le fichier est relu par des admins qui connaissent le schéma.
  const columns: TCsvColumn<Record<string, unknown>>[] = keys.map((key) => ({ key, header: key }))
  const csv = toCsv(columns, enriched)
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="residences${filenameSuffix}-${date}.csv"`,
    },
  })
}
