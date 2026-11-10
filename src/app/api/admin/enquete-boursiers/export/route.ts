import { NextRequest } from 'next/server'
import { listSurveyRows, SURVEY_STATUS_FILTERS, type SurveyAdminRow, type SurveyStatusFilter } from '~/server/scholarship-survey/admin'
import { getServerSession } from '~/services/better-auth'
import { type TCsvColumn, toCsv } from '~/utils/csv'
import { formatDateTime } from '~/utils/formatDate'

type CsvRow = {
  ownerName: string
  accommodationName: string
  city: string | null
  scholarshipCount: number | null
  scholarshipRate: number | null
  notMeasured: string
  updatedAt: string
  updatedBy: string | null
  ownerCompletedAt: string
}

const COLUMNS: TCsvColumn<CsvRow>[] = [
  { key: 'ownerName', header: 'Bailleur' },
  { key: 'accommodationName', header: 'Résidence' },
  { key: 'city', header: 'Ville' },
  { key: 'scholarshipCount', header: 'Nombre de boursiers' },
  { key: 'scholarshipRate', header: 'Part de boursiers (%)' },
  { key: 'notMeasured', header: 'Non mesuré' },
  { key: 'updatedAt', header: 'Dernière mise à jour' },
  { key: 'updatedBy', header: 'Auteur' },
  { key: 'ownerCompletedAt', header: 'Enquête bailleur complétée le' },
]

const toCsvRow = (row: SurveyAdminRow): CsvRow => ({
  ownerName: row.ownerName,
  accommodationName: row.accommodationName,
  city: row.city,
  scholarshipCount: row.scholarshipCount,
  scholarshipRate: row.scholarshipRate,
  notMeasured: row.notMeasured === null ? '' : row.notMeasured ? 'Oui' : 'Non',
  updatedAt: row.updatedAt ? formatDateTime(row.updatedAt) : '',
  updatedBy: row.updatedBy,
  ownerCompletedAt: row.ownerCompletedAt ? formatDateTime(row.ownerCompletedAt) : '',
})

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session || session.user.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 })
  }

  const statusParam = request.nextUrl.searchParams.get('status')
  const status: SurveyStatusFilter = SURVEY_STATUS_FILTERS.find((s) => s === statusParam) ?? 'all'
  const search = request.nextUrl.searchParams.get('search') ?? undefined

  const { rows } = await listSurveyRows({ status, search })
  const date = new Date().toISOString().slice(0, 10)

  return new Response(toCsv(COLUMNS, rows.map(toCsvRow)), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="enquete-boursiers-${date}.csv"`,
    },
  })
}
