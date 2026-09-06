import { NextRequest } from 'next/server'
import { getOwnerForUser } from '~/server/bailleur/get-owner-for-user'
import { getDateRange, listAccommodationStats, ZStatisticsPeriod } from '~/server/statistics/accommodation-stats'
import { getServerSession } from '~/services/better-auth'
import { type TCsvColumn, toCsv } from '~/utils/csv'

type TStatsCsvRow = {
  residence: string
  ville: string | null
  codePostal: string | null
  publiee: boolean
  vues: number
  consultationsOffre: number
  favoris: number
  periodeDebut: string
  periodeFin: string
}

const COLUMNS: TCsvColumn<TStatsCsvRow>[] = [
  { key: 'residence', header: 'Résidence' },
  { key: 'ville', header: 'Ville' },
  { key: 'codePostal', header: 'Code postal' },
  { key: 'publiee', header: 'Publiée' },
  { key: 'vues', header: 'Vues de la fiche' },
  { key: 'consultationsOffre', header: "Consultations de l'offre" },
  { key: 'favoris', header: 'Mises en favori' },
  // Répétées sur chaque ligne : un fichier détaché de son nom reste interprétable.
  { key: 'periodeDebut', header: 'Début de période' },
  { key: 'periodeFin', header: 'Fin de période' },
]

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10)

/**
 * Extraction CSV des statistiques d'engagement de toutes les résidences d'un gestionnaire, sur la
 * période choisie dans la modale du tableau de bord.
 *
 * Les lignes viennent de la même requête que le tableau affiché à l'écran, sans pagination ni
 * recherche : l'extraction porte sur l'intégralité du parc.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return new Response('Unauthorized', { status: 401 })
  if (session.user.role !== 'owner' && session.user.role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }

  const period = ZStatisticsPeriod.safeParse(request.nextUrl.searchParams.get('period') ?? '30d')
  if (!period.success) return new Response('Période invalide', { status: 400 })

  const ownerIdParam = request.nextUrl.searchParams.get('ownerId')
  const ownerId = ownerIdParam ? Number(ownerIdParam) : undefined
  if (ownerIdParam && !Number.isInteger(ownerId)) return new Response('Gestionnaire invalide', { status: 400 })

  // `getOwnerForUser` fait l'arbitrage d'accès : un administrateur ne peut viser un gestionnaire que
  // s'il y est rattaché, et retombe sinon sur le sien.
  const owner = await getOwnerForUser(session.user.id, ownerId)
  if (!owner) return new Response('Forbidden', { status: 403 })

  const { from, to } = getDateRange(period.data)
  const stats = await listAccommodationStats({ ownerId: owner.id, period: period.data })

  const csv = toCsv(
    COLUMNS,
    stats.map((row) => ({
      residence: row.name,
      ville: row.cityName,
      codePostal: row.postalCode,
      publiee: row.published,
      vues: row.nbViews,
      consultationsOffre: row.nbConsultOffer,
      favoris: row.nbFavorites,
      periodeDebut: toIsoDate(from),
      periodeFin: toIsoDate(to),
    })),
  )

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="statistiques-${owner.slug}-${period.data}-${toIsoDate(to)}.csv"`,
    },
  })
}
