import { NextRequest } from 'next/server'
import { z } from 'zod'
import { hasPermission } from '~/server/bailleur/permissions'
import { BAILLEUR_CONTACTS_EXPORT_COLUMNS, getBailleurContactsExport } from '~/server/exports/bailleur-contacts'
import { logActivity } from '~/server/services/activity-logger'
import { getServerSession } from '~/services/better-auth'
import { toCsv } from '~/utils/csv'
import { formatIsoDate } from '~/utils/date-helpers'

const ZExportQuery = z.object({
  ownerId: z.coerce.number().int().positive().optional(),
  region: z.string().trim().min(1).max(100).optional(),
  residence: z.string().trim().min(1).max(255).optional(),
})

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

  const params = request.nextUrl.searchParams
  const query = ZExportQuery.safeParse({
    ownerId: params.get('ownerId') ?? undefined,
    region: params.get('region') ?? undefined,
    residence: params.get('residence') ?? undefined,
  })
  if (!query.success) return new Response('Paramètres invalides', { status: 400 })

  const { ownerId, region, residence } = query.data
  const result = await getBailleurContactsExport({
    userId: session.user.id,
    ownerId,
    filters: { region, residenceSlug: residence },
  })
  if (result.status === 'forbidden') return new Response('Forbidden', { status: 403 })
  if (result.status === 'residence_not_found') return new Response('Résidence introuvable', { status: 404 })

  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: 'contacts.exported',
    entityType: 'owner',
    entityId: String(result.owner.id),
    entityName: result.owner.name,
    ownerId: result.owner.id,
    ownerName: result.owner.name,
    metadata: { region: region ?? null, residence: residence ?? null, rowCount: result.rows.length },
  })

  return new Response(toCsv(BAILLEUR_CONTACTS_EXPORT_COLUMNS, result.rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contacts-${result.owner.slug}-${formatIsoDate(new Date())}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
