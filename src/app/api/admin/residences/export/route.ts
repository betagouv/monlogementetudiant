import { and, eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { owners } from '~/server/db/schema/owners'
import { getServerSession } from '~/services/better-auth'
import { calculateAvailability } from '~/utils/calculateAvailability'

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
      targetAudience: accommodations.target_audience,
      published: accommodations.published,
      city: cities.name,
      ownerName: owners.name,
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
      superficieMinT1: accommodations.superficieMinT1,
      superficieMaxT1: accommodations.superficieMaxT1,
      superficieMinT1Bis: accommodations.superficieMinT1Bis,
      superficieMaxT1Bis: accommodations.superficieMaxT1Bis,
      superficieMinT2: accommodations.superficieMinT2,
      superficieMaxT2: accommodations.superficieMaxT2,
      superficieMinT3: accommodations.superficieMinT3,
      superficieMaxT3: accommodations.superficieMaxT3,
      superficieMinT4: accommodations.superficieMinT4,
      superficieMaxT4: accommodations.superficieMaxT4,
      superficieMinT5: accommodations.superficieMinT5,
      superficieMaxT5: accommodations.superficieMaxT5,
      superficieMinT6: accommodations.superficieMinT6,
      superficieMaxT6: accommodations.superficieMaxT6,
      superficieMinT7More: accommodations.superficieMinT7More,
      superficieMaxT7More: accommodations.superficieMaxT7More,
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
      imagesCount: accommodations.imagesCount,
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
    .where(where)
    .orderBy(accommodations.name)

  const enriched = results.map((row) => {
    const availability = {
      nb_t1_available: row.nbT1Available,
      nb_t1_bis_available: row.nbT1BisAvailable,
      nb_t2_available: row.nbT2Available,
      nb_t3_available: row.nbT3Available,
      nb_t4_available: row.nbT4Available,
      nb_t5_available: row.nbT5Available,
      nb_t6_available: row.nbT6Available,
      nb_t7_more_available: row.nbT7MoreAvailable,
    }
    const stock = {
      nb_t1: row.nbT1,
      nb_t1_bis: row.nbT1Bis,
      nb_t2: row.nbT2,
      nb_t3: row.nbT3,
      nb_t4: row.nbT4,
      nb_t5: row.nbT5,
      nb_t6: row.nbT6,
      nb_t7_more: row.nbT7More,
    }
    const disponibiliteRenseignee = Object.values(availability).some((v) => v !== null && v !== undefined)
    const nbLogementsDisponibles = calculateAvailability(availability, stock)
    return { ...row, disponibiliteRenseignee, nbLogementsDisponibles }
  })

  const headers = enriched[0] ? Object.keys(enriched[0]) : []
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
