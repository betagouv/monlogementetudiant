import { NextRequest } from 'next/server'
import { hasPermission } from '~/server/bailleur/permissions'
import { getDateRange, ZStatisticsPeriod } from '~/server/statistics/accommodation-stats'
import { getContactStatsForUser } from '~/server/statistics/contact-stats'
import { getServerSession } from '~/services/better-auth'
import { contactStatsShare } from '~/utils/contact-stats-share'
import { type TCsvColumn, toCsv } from '~/utils/csv'
import { formatIsoDate } from '~/utils/date-helpers'

type TContactStatsCsvRow = {
  residence: string
  ville: string | null
  recues: number
  nonModere: number
  nonModerePart: number | null
  nonRetenu: number
  nonRetenuPart: number | null
  contacte: number
  contactePart: number | null
  logementAttribue: number
  logementAttribuePart: number | null
  periodeDebut: string
  periodeFin: string
}

const COLUMNS: TCsvColumn<TContactStatsCsvRow>[] = [
  { key: 'residence', header: 'Résidence' },
  { key: 'ville', header: 'Ville' },
  { key: 'recues', header: 'Demandes reçues' },
  { key: 'nonModere', header: 'Non modéré' },
  { key: 'nonModerePart', header: 'Non modéré (%)' },
  { key: 'nonRetenu', header: 'Non retenu' },
  { key: 'nonRetenuPart', header: 'Non retenu (%)' },
  { key: 'contacte', header: 'Contacté' },
  { key: 'contactePart', header: 'Contacté (%)' },
  { key: 'logementAttribue', header: 'Logement attribué' },
  { key: 'logementAttribuePart', header: 'Logement attribué (%)' },
  { key: 'periodeDebut', header: 'Début de période' },
  { key: 'periodeFin', header: 'Fin de période' },
]

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return new Response('Unauthorized', { status: 401 })
  if (session.user.role !== 'owner' && session.user.role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }
  const canManage = hasPermission(
    {
      role: session.user.role,
      bailleurRole: session.user.bailleurRole ?? null,
      bailleurPermissions: session.user.bailleurPermissions ?? [],
    },
    'manage_applications',
  )
  if (!canManage) return new Response('Forbidden', { status: 403 })

  const period = ZStatisticsPeriod.safeParse(request.nextUrl.searchParams.get('period') ?? '30d')
  if (!period.success) return new Response('Période invalide', { status: 400 })

  const ownerIdParam = request.nextUrl.searchParams.get('ownerId')
  const ownerId = ownerIdParam ? Number(ownerIdParam) : undefined
  if (ownerIdParam && !Number.isInteger(ownerId)) return new Response('Gestionnaire invalide', { status: 400 })

  const stats = await getContactStatsForUser({ userId: session.user.id, ownerId, period: period.data })
  if (!stats) return new Response('Forbidden', { status: 403 })

  const { from, to } = getDateRange(period.data)
  const toCsvRow = (counts: (typeof stats)['total'], residence: string, ville: string | null): TContactStatsCsvRow => ({
    residence,
    ville,
    recues: counts.received,
    nonModere: counts.nonModere,
    nonModerePart: contactStatsShare(counts.nonModere, counts.received),
    nonRetenu: counts.nonRetenu,
    nonRetenuPart: contactStatsShare(counts.nonRetenu, counts.received),
    contacte: counts.contacte,
    contactePart: contactStatsShare(counts.contacte, counts.received),
    logementAttribue: counts.logementAttribue,
    logementAttribuePart: contactStatsShare(counts.logementAttribue, counts.received),
    periodeDebut: formatIsoDate(from),
    periodeFin: formatIsoDate(to),
  })

  const csv = toCsv(COLUMNS, [...stats.rows.map((row) => toCsvRow(row, row.residence, row.city)), toCsvRow(stats.total, 'Total', null)])

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contacts-${stats.owner.slug}-${period.data}-${formatIsoDate(to)}.csv"`,
    },
  })
}
