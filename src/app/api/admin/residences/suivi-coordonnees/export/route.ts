import { CONTACT_FOLLOW_UP_COLUMNS, getContactFollowUpRows } from '~/server/exports/contact-follow-up'
import { getServerSession } from '~/services/better-auth'
import { toCsv } from '~/utils/csv'

export async function GET() {
  const session = await getServerSession()
  if (!session || session.user.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 })
  }

  const rows = await getContactFollowUpRows()
  const csv = toCsv(CONTACT_FOLLOW_UP_COLUMNS, rows)
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="suivi-coordonnees-${date}.csv"`,
    },
  })
}
