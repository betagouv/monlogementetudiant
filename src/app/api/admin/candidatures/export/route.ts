import { and, eq, sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { APARTMENT_TYPE_LABELS, type ApartmentType } from '~/enums/apartment-type'
import { EContactStatus } from '~/enums/contact-status'
import { ZAdminCandidaturesPeriod } from '~/schemas/candidatures/admin-period'
import { contactScholarshipStatus, createdInPeriod } from '~/server/candidatures/admin-period'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { user } from '~/server/db/schema/auth'
import { cities } from '~/server/db/schema/cities'
import { contactRequests } from '~/server/db/schema/contacts'
import { dossierFacileApplications, dossierFacileTenants } from '~/server/db/schema/dossier-facile'
import { owners } from '~/server/db/schema/owners'
import { getServerSession } from '~/services/better-auth'
import { type TCsvColumn, toCsv } from '~/utils/csv'
import { formatIsoDate } from '~/utils/date-helpers'

type TCandidatureCsvRow = {
  date: string
  residence: string
  ville: string
  gestionnaire: string
  canal: string
  statut: string
  type_logement: string
  boursier: string
  compte: string
}

const COLUMNS: TCsvColumn<TCandidatureCsvRow>[] = [
  { key: 'date', header: 'date' },
  { key: 'residence', header: 'residence' },
  { key: 'ville', header: 'ville' },
  { key: 'gestionnaire', header: 'gestionnaire' },
  { key: 'canal', header: 'canal' },
  { key: 'statut', header: 'statut' },
  { key: 'type_logement', header: 'type_logement' },
  { key: 'boursier', header: 'boursier' },
  { key: 'compte', header: 'compte' },
]

const STATUS_LABELS: Record<EContactStatus, string> = {
  [EContactStatus.A_MODERER]: 'À modérer',
  [EContactStatus.A_CONTACTER]: 'À contacter',
  [EContactStatus.CONTACTE]: 'Contacté',
  [EContactStatus.NON_RETENU]: 'Non retenu',
}

const SCHOLARSHIP_LABELS: Record<'yes' | 'no' | 'unknown', string> = {
  yes: 'Oui',
  no: 'Non',
  unknown: 'Ne sait pas',
}

const apartmentTypeLabel = (value: string | null) => (value ? (APARTMENT_TYPE_LABELS[value as ApartmentType] ?? value) : '')

const residenceColumns = {
  residence: accommodations.name,
  ville: cities.name,
  gestionnaire: owners.name,
}

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session || session.user.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 })
  }

  const period = ZAdminCandidaturesPeriod.safeParse({
    from: request.nextUrl.searchParams.get('from'),
    to: request.nextUrl.searchParams.get('to'),
  })
  if (!period.success) {
    return new Response(period.error.issues[0]?.message ?? 'Période invalide', { status: 400 })
  }

  const mainAddress = and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true))

  const [contacts, dossierFacile] = await Promise.all([
    db
      .select({
        createdAt: contactRequests.createdAt,
        ...residenceColumns,
        status: contactRequests.status,
        apartmentType: contactRequests.apartmentType,
        scholarshipStatus: contactScholarshipStatus,
        hasAccount: sql<boolean>`${contactRequests.userId} is not null`,
      })
      .from(contactRequests)
      .innerJoin(accommodations, eq(accommodations.id, contactRequests.accommodationId))
      .leftJoin(owners, eq(owners.id, accommodations.ownerId))
      .leftJoin(accommodationAddresses, mainAddress)
      .leftJoin(cities, eq(cities.id, accommodationAddresses.cityId))
      .leftJoin(user, eq(user.id, contactRequests.userId))
      .where(createdInPeriod(contactRequests.createdAt, period.data)),
    db
      .select({
        createdAt: dossierFacileApplications.createdAt,
        ...residenceColumns,
        status: dossierFacileApplications.status,
        apartmentType: dossierFacileApplications.apartmentType,
        scholarshipStatus: user.scholarshipStatus,
      })
      .from(dossierFacileApplications)
      .innerJoin(dossierFacileTenants, eq(dossierFacileTenants.id, dossierFacileApplications.tenantId))
      .innerJoin(user, eq(user.id, dossierFacileTenants.userId))
      .leftJoin(accommodations, eq(accommodations.slug, dossierFacileApplications.accommodationSlug))
      .leftJoin(owners, eq(owners.id, accommodations.ownerId))
      .leftJoin(accommodationAddresses, mainAddress)
      .leftJoin(cities, eq(cities.id, accommodationAddresses.cityId))
      .where(createdInPeriod(dossierFacileApplications.createdAt, period.data)),
  ])

  const rows = [
    ...contacts.map((row) => ({ ...row, canal: 'Coordonnées', compte: row.hasAccount ? 'Étudiant connecté' : 'Visiteur' })),
    ...dossierFacile.map((row) => ({ ...row, canal: 'DossierFacile', compte: 'Étudiant connecté' })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(
      (row): TCandidatureCsvRow => ({
        date: formatIsoDate(row.createdAt),
        residence: row.residence ?? '',
        ville: row.ville ?? '',
        gestionnaire: row.gestionnaire ?? '',
        canal: row.canal,
        statut: STATUS_LABELS[row.status] ?? row.status,
        type_logement: apartmentTypeLabel(row.apartmentType),
        boursier: row.scholarshipStatus ? SCHOLARSHIP_LABELS[row.scholarshipStatus] : 'Non renseigné',
        compte: row.compte,
      }),
    )

  return new Response(toCsv(COLUMNS, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="candidatures-${period.data.from}-${period.data.to}.csv"`,
    },
  })
}
