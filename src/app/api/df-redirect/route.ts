import { eq } from 'drizzle-orm'
import { jwtVerify } from 'jose'
import { NextResponse } from 'next/server'
import { db } from '~/server/db'
import { dossierFacileDocuments, dossierFacileTenants } from '~/server/db/schema'
import { getJwtSecret } from '~/server/utils/jwt-secret'

const ERROR_PAGE = '/dossier-facile/error'

function errorRedirect(errorType: string) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
  return NextResponse.redirect(`${baseUrl}${ERROR_PAGE}?error_type=${errorType}`)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return errorRedirect('doc_invalid_link')
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    const { urlType, targetId } = payload as { urlType: string; targetId: string }

    let url: string | null = null

    if (urlType === 'tenantPdf') {
      const tenant = await db.query.dossierFacileTenants.findFirst({
        where: eq(dossierFacileTenants.id, targetId),
        columns: { pdfUrl: true },
      })
      url = tenant?.pdfUrl ?? null
    } else if (urlType === 'tenantUrl') {
      const tenant = await db.query.dossierFacileTenants.findFirst({
        where: eq(dossierFacileTenants.id, targetId),
        columns: { url: true },
      })
      url = tenant?.url ?? null
    } else if (urlType === 'document') {
      const doc = await db.query.dossierFacileDocuments.findFirst({
        where: eq(dossierFacileDocuments.id, targetId),
        columns: { url: true },
      })
      url = doc?.url ?? null
    }

    if (!url) {
      return errorRedirect('doc_not_found')
    }

    return NextResponse.redirect(url)
  } catch {
    return errorRedirect('doc_expired')
  }
}
