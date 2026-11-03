import { NextResponse } from 'next/server'
import { hasPermission } from '~/server/bailleur/permissions'
import { MAX_TOTAL_IMAGES_SIZE } from '~/server/bailleur/residence-images'
import { crossOriginForbidden, isSameOriginRequest } from '~/server/utils/same-origin'
import { getServerSession } from '~/services/better-auth'

const MAX_MULTIPART_OVERHEAD = 1024 * 1024

type TSessionUser = NonNullable<Awaited<ReturnType<typeof getServerSession>>>['user']

export async function authorizeResidenceImagesRequest(request: Request): Promise<{ user: TSessionUser } | { response: Response }> {
  if (!isSameOriginRequest(request)) return { response: crossOriginForbidden() }

  const auth = await getServerSession()
  if (!auth || !auth.session) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { role, owner } = auth.user
  const canManageResidences =
    (role === 'owner' || role === 'admin') &&
    hasPermission(
      { role, bailleurRole: auth.user.bailleurRole ?? null, bailleurPermissions: auth.user.bailleurPermissions ?? [] },
      'manage_residences',
    )
  if (!canManageResidences || (role !== 'admin' && !owner)) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const contentLength = Number(request.headers.get('content-length'))
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    return { response: NextResponse.json({ error: 'Content-Length requis' }, { status: 411 }) }
  }
  if (contentLength > MAX_TOTAL_IMAGES_SIZE + MAX_MULTIPART_OVERHEAD) {
    return { response: NextResponse.json({ error: 'Requête trop volumineuse' }, { status: 413 }) }
  }

  return { user: auth.user }
}

export function imageFilesFrom(formData: FormData): File[] | null {
  const entries = formData.getAll('images')
  return entries.every((entry) => entry instanceof File) ? (entries as File[]) : null
}
