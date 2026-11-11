import type { NextRequest } from 'next/server'
import { buildExport, parseExportRequest } from '~/server/admin-metrics/exports'
import { getServerSession } from '~/services/better-auth'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session || session.user.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const parsed = parseExportRequest({
    item: params.get('item'),
    from: params.get('from'),
    to: params.get('to'),
    month: params.get('month'),
  })
  if (!parsed.success) {
    return new Response(parsed.message, { status: 400 })
  }

  const { filename, csv } = await buildExport(parsed.data)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
