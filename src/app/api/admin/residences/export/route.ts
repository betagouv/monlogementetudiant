import { and, eq, inArray, sql } from 'drizzle-orm'
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

  // Dernière mise à jour des disponibilités, par résidence.
  //
  // Portée par `accommodation_typology` (colonnes `availability_updated_*`), tamponnée quand un
  // gestionnaire renseigne une disponibilité — les imports et les scripts n'y touchent pas. Une
  // résidence a une ligne par typologie : on retient la plus récente, et l'auteur qui va avec.
  const availabilityUpdates = accIds.length
    ? await db.execute<{ accommodationId: number; updatedAt: string; updatedByName: string | null }>(sql`
        SELECT DISTINCT ON (t.accommodation_id)
          t.accommodation_id::int AS "accommodationId",
          t.availability_updated_at AS "updatedAt",
          nullif(trim(concat_ws(' ', u.firstname, u.lastname)), '') AS "updatedByName"
        FROM accommodation_typology t
        LEFT JOIN "user" u ON u.id = t.availability_updated_by
        WHERE t.accommodation_id IN (${sql.join(
          accIds.map((id) => sql`${id}`),
          sql`, `,
        )})
          AND t.availability_updated_at IS NOT NULL
        ORDER BY t.accommodation_id, t.availability_updated_at DESC
      `)
    : []
  const availabilityByAccommodation = new Map(availabilityUpdates.map((row) => [row.accommodationId, row]))

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
    const lastAvailabilityUpdate = availabilityByAccommodation.get(rawRow.id)
    return {
      ...rawRow,
      ...flat,
      region,
      disponibiliteRenseignee: nbLogementsDisponibles != null,
      nbLogementsDisponibles,
      availabilityUpdatedAt: lastAvailabilityUpdate?.updatedAt ?? null,
      availabilityUpdatedBy: lastAvailabilityUpdate?.updatedByName ?? null,
    }
  })

  // Colonnes calculées hors select : on les replace au milieu des colonnes qu'elles complètent
  // (territoire pour `region`, horodatage pour le suivi des dispos) plutôt qu'en fin de fichier.
  const REPOSITIONED = ['region', 'availabilityUpdatedAt', 'availabilityUpdatedBy']
  const headers = enriched[0] ? Object.keys(enriched[0]).filter((h) => !REPOSITIONED.includes(h)) : []
  const deptIndex = headers.indexOf('departmentName')
  if (deptIndex !== -1) headers.splice(deptIndex + 1, 0, 'region')
  const updatedIndex = headers.indexOf('updatedAt')
  if (updatedIndex !== -1) headers.splice(updatedIndex + 1, 0, 'availabilityUpdatedAt', 'availabilityUpdatedBy')
  const lines = [
    headers.join(';'),
    ...enriched.map((row) =>
      headers
        .map((h) => {
          const val = (row as Record<string, unknown>)[h]
          if (val === null || val === undefined) return ''
          if (val instanceof Date) return val.toISOString()
          const str = String(val)
          if (str.includes(';') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(';'),
    ),
  ]
  // BOM so Excel reads UTF-8 accents correctly
  const csv = `﻿${lines.join('\n')}`
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="residences${filenameSuffix}-${date}.csv"`,
    },
  })
}
