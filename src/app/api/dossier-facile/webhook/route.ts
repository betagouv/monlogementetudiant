import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '~/server/db'
import { dossierFacileTenants } from '~/server/db/schema'

export async function POST(request: Request) {
  const apiKey = process.env.DOSSIERFACILE_WEBHOOK_API_KEY
  if (!apiKey) {
    console.error('[DossierFacile Webhook] DOSSIERFACILE_WEBHOOK_API_KEY is not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const requestApiKey = request.headers.get('X-Api-Key')
  if (requestApiKey !== apiKey) {
    console.warn('[DossierFacile Webhook] Unauthorized request - invalid API key')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { partnerCallBackType?: string; tenantId?: string | number }
  try {
    body = await request.json()
  } catch {
    console.warn('[DossierFacile Webhook] Failed to parse JSON body')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  console.log('[DossierFacile Webhook] Received:', JSON.stringify(body))

  const { partnerCallBackType, tenantId } = body
  if (!partnerCallBackType || !tenantId) {
    console.warn('[DossierFacile Webhook] Missing partnerCallBackType or tenantId')
    return NextResponse.json({ error: 'Missing partnerCallBackType or tenantId' }, { status: 400 })
  }

  const tenantIdStr = String(tenantId)

  switch (partnerCallBackType) {
    case 'DELETED_ACCOUNT': {
      console.log(`[DossierFacile Webhook] DELETED_ACCOUNT for tenant ${tenantIdStr}`)
      await db.delete(dossierFacileTenants).where(eq(dossierFacileTenants.tenantId, tenantIdStr))
      console.log(`[DossierFacile Webhook] Tenant ${tenantIdStr} deleted successfully`)
      return NextResponse.json({ ok: true })
    }

    case 'ACCESS_REVOKED': {
      console.log(`[DossierFacile Webhook] ACCESS_REVOKED for tenant ${tenantIdStr}`)
      await db
        .update(dossierFacileTenants)
        .set({ status: 'access_revoked', updatedAt: new Date() })
        .where(eq(dossierFacileTenants.tenantId, tenantIdStr))
      console.log(`[DossierFacile Webhook] Tenant ${tenantIdStr} status set to access_revoked`)
      return NextResponse.json({ ok: true })
    }

    case 'VERIFIED_ACCOUNT': {
      console.log(`[DossierFacile Webhook] VERIFIED_ACCOUNT for tenant ${tenantIdStr}`)
      await db
        .update(dossierFacileTenants)
        .set({ status: 'verified', updatedAt: new Date() })
        .where(eq(dossierFacileTenants.tenantId, tenantIdStr))
      console.log(`[DossierFacile Webhook] Tenant ${tenantIdStr} status set to verified`)
      return NextResponse.json({ ok: true })
    }

    case 'DENIED_ACCOUNT': {
      console.log(`[DossierFacile Webhook] DENIED_ACCOUNT for tenant ${tenantIdStr}`)
      await db
        .update(dossierFacileTenants)
        .set({ status: 'denied', updatedAt: new Date() })
        .where(eq(dossierFacileTenants.tenantId, tenantIdStr))
      console.log(`[DossierFacile Webhook] Tenant ${tenantIdStr} status set to denied`)
      return NextResponse.json({ ok: true })
    }

    default:
      console.warn(`[DossierFacile Webhook] Unknown callback type: ${partnerCallBackType} for tenant ${tenantIdStr}`)
      return NextResponse.json({ error: `Unknown callback type: ${partnerCallBackType}` }, { status: 400 })
  }
}
