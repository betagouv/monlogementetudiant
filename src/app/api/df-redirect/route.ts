import { eq } from 'drizzle-orm'
import { jwtVerify } from 'jose'
import { NextResponse } from 'next/server'
import { db } from '~/server/db'
import { dossierFacileDocuments, dossierFacileTenants } from '~/server/db/schema'
import { getJwtSecret } from '~/server/utils/jwt-secret'

const ERROR_PAGE = '/dossier-facile/error'

function errorRedirect(request: Request, errorType: string) {
  const baseUrl = new URL(request.url).origin
  return NextResponse.redirect(`${baseUrl}${ERROR_PAGE}?error_type=${errorType}`)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return errorRedirect(request, 'doc_invalid_link')
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
      return errorRedirect(request, 'doc_not_found')
    }

    // tenantUrl is an external web page (DossierFacile profile) — redirect instead of proxy,
    // because proxying HTML breaks relative CSS/JS links.
    if (urlType === 'tenantUrl') {
      return NextResponse.redirect(url)
    }

    // Proxy: fetch the document server-side and stream it to the client.
    // The real URL never reaches the browser.
    const upstream = await fetch(url)

    if (!upstream.ok) {
      return errorRedirect(request, 'doc_unavailable')
    }

    const headers = new Headers()
    const contentType = upstream.headers.get('content-type')
    if (contentType) headers.set('content-type', contentType)
    const contentDisposition = upstream.headers.get('content-disposition')
    if (contentDisposition) headers.set('content-disposition', contentDisposition)
    const contentLength = upstream.headers.get('content-length')
    if (contentLength) headers.set('content-length', contentLength)

    // Prevent caching so the token cannot be replayed via browser cache
    headers.set('cache-control', 'no-store, no-cache, must-revalidate')

    return new Response(upstream.body, { status: 200, headers })
  } catch {
    return errorRedirect(request, 'doc_expired')
  }
}
