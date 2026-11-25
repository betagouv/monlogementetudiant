import { canAccessStudentSpace } from '~/lib/roles'
import { collectStudentData } from '~/server/users/export-data'
import { getServerSession } from '~/services/better-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Export RGPD : l'étudiant télécharge l'ensemble de ses données au format JSON (portabilité, art. 20). */
export async function GET() {
  const session = await getServerSession()
  if (!session) return new Response('Unauthorized', { status: 401 })
  if (!canAccessStudentSpace(session.user.role)) return new Response('Forbidden', { status: 403 })

  const data = await collectStudentData(session.user.id)
  if (!data) return new Response('Not found', { status: 404 })

  const date = new Date().toISOString().split('T')[0]
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="mes-donnees-monlogementetudiant-${date}.json"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
