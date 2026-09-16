import { eq } from 'drizzle-orm'
import { jwtVerify } from 'jose'
import { NextResponse } from 'next/server'
import { checkAccommodationAccess } from '~/server/bailleur/accommodation-access'
import { findScopedApplicationForTenant } from '~/server/bailleur/accommodation-scope'
import { hasPermission } from '~/server/bailleur/permissions'
import { db } from '~/server/db'
import { accommodations, dossierFacileDocuments, dossierFacileTenants } from '~/server/db/schema'
import { env } from '~/server/env'
import { getJwtSecret } from '~/server/utils/jwt-secret'
import { getServerSession } from '~/services/better-auth'

const ERROR_PAGE = '/dossier-facile/error'

function errorRedirect(errorType: string) {
  const baseUrl = env.BASE_URL
  return NextResponse.redirect(`${baseUrl}${ERROR_PAGE}?error_type=${errorType}`)
}

/**
 * Redirige vers une pièce du dossier DossierFacile d'un candidat.
 *
 * Le jeton signé (60 s) ne vaut pas autorisation : session, propriété de la résidence et fenêtre
 * de rétention sont vérifiées à chaque consommation.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return errorRedirect('doc_invalid_link')
  }

  const session = await getServerSession()
  if (!session) {
    return errorRedirect('doc_forbidden')
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    const { urlType, targetId, sub } = payload as { urlType: string; targetId: string; sub?: string }

    // Le jeton est nominatif : il ne vaut que pour le compte auquel il a été délivré.
    if (sub !== session.user.id) {
      return errorRedirect('doc_forbidden')
    }

    const document =
      urlType === 'document'
        ? await db.query.dossierFacileDocuments.findFirst({
            where: eq(dossierFacileDocuments.id, targetId),
            columns: { url: true, tenantId: true },
          })
        : null

    const tenantId = urlType === 'document' ? document?.tenantId : targetId
    if (!tenantId) return errorRedirect('doc_not_found')

    const application = await findScopedApplicationForTenant(session.user.id, tenantId)
    if (!application) return errorRedirect('doc_forbidden')

    // Route hors tRPC : les autorisations sont vérifiées ici.
    const caller = {
      role: session.user.role,
      bailleurRole: session.user.bailleurRole ?? null,
      bailleurPermissions: session.user.bailleurPermissions ?? [],
    }
    if (!hasPermission(caller, 'manage_applications')) return errorRedirect('doc_forbidden')

    if ((await checkAccommodationAccess(session.user.id, eq(accommodations.slug, application.accommodationSlug))) !== 'ok') {
      return errorRedirect('doc_forbidden')
    }

    let url: string | null = null

    if (urlType === 'tenantPdf' || urlType === 'tenantUrl') {
      const tenant = await db.query.dossierFacileTenants.findFirst({
        where: eq(dossierFacileTenants.id, tenantId),
        columns: { url: true, pdfUrl: true },
      })
      url = (urlType === 'tenantPdf' ? tenant?.pdfUrl : tenant?.url) ?? null
    } else if (urlType === 'document') {
      url = document?.url ?? null
    }

    if (!url) {
      return errorRedirect('doc_not_found')
    }

    return NextResponse.redirect(url)
  } catch {
    return errorRedirect('doc_expired')
  }
}
