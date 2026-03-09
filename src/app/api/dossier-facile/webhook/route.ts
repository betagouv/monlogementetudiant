import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '~/server/db'
import { dossierFacileTenants } from '~/server/db/schema'

export async function POST(request: Request) {
  const apiKey = process.env.DOSSIERFACILE_WEBHOOK_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const requestApiKey = request.headers.get('X-Api-Key')
  if (requestApiKey !== apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { partnerCallBackType?: string; tenantId?: string | number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { partnerCallBackType, tenantId } = body
  if (!partnerCallBackType || !tenantId) {
    return NextResponse.json({ error: 'Missing partnerCallBackType or tenantId' }, { status: 400 })
  }

  const tenantIdStr = String(tenantId)

  switch (partnerCallBackType) {
    case 'DELETED_ACCOUNT': {
      await db.delete(dossierFacileTenants).where(eq(dossierFacileTenants.tenantId, tenantIdStr))
      return NextResponse.json({ ok: true })
    }

    case 'ACCESS_REVOKED': {
      await db
        .update(dossierFacileTenants)
        .set({ status: 'access_revoked', updatedAt: new Date() })
        .where(eq(dossierFacileTenants.tenantId, tenantIdStr))
      return NextResponse.json({ ok: true })
    }

    case 'VERIFIED_ACCOUNT': {
      await db
        .update(dossierFacileTenants)
        .set({ status: 'verified', updatedAt: new Date() })
        .where(eq(dossierFacileTenants.tenantId, tenantIdStr))
      return NextResponse.json({ ok: true })
    }

    case 'DENIED_ACCOUNT': {
      await db
        .update(dossierFacileTenants)
        .set({ status: 'denied', updatedAt: new Date() })
        .where(eq(dossierFacileTenants.tenantId, tenantIdStr))
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: `Unknown callback type: ${partnerCallBackType}` }, { status: 400 })
  }
}
