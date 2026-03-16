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

  let body: { partnerCallBackType?: string; onTenantId?: string | number }
  try {
    body = await request.json()
  } catch {
    console.warn('[DossierFacile Webhook] Failed to parse JSON body')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  console.log('[DossierFacile Webhook] Received:', JSON.stringify(body))

  const { partnerCallBackType, onTenantId: tenantId } = body
  if (!partnerCallBackType || !tenantId) {
    console.warn('[DossierFacile Webhook] Missing partnerCallBackType or tenantId')
    return NextResponse.json({ error: 'Missing partnerCallBackType or tenantId' }, { status: 400 })
  }

  const tenantIdStr = String(tenantId)

  switch (partnerCallBackType) {
    case 'CREATED_ACCOUNT': {
      console.log(`[DossierFacile Webhook] CREATED_ACCOUNT for tenant ${tenantIdStr}`)
      await db
        .update(dossierFacileTenants)
        .set({ status: 'to_process', updatedAt: new Date() })
        .where(eq(dossierFacileTenants.tenantId, tenantIdStr))
      console.log(`[DossierFacile Webhook] Tenant ${tenantIdStr} status set to to_process`)
      return NextResponse.json({ ok: true })
    }

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

    case 'APPLICATION_TYPE_CHANGED': {
      console.log(`[DossierFacile Webhook] APPLICATION_TYPE_CHANGED for tenant ${tenantIdStr}`)
      await db
        .update(dossierFacileTenants)
        .set({ status: 'incomplete', updatedAt: new Date() })
        .where(eq(dossierFacileTenants.tenantId, tenantIdStr))
      console.log(`[DossierFacile Webhook] Tenant ${tenantIdStr} status set to incomplete`)
      return NextResponse.json({ ok: true })
    }

    case 'ARCHIVED_ACCOUNT': {
      console.log(`[DossierFacile Webhook] ARCHIVED_ACCOUNT for tenant ${tenantIdStr}`)
      await db
        .update(dossierFacileTenants)
        .set({ status: 'inactive', updatedAt: new Date() })
        .where(eq(dossierFacileTenants.tenantId, tenantIdStr))
      console.log(`[DossierFacile Webhook] Tenant ${tenantIdStr} status set to inactive`)
      return NextResponse.json({ ok: true })
    }

    case 'RETURNED_ACCOUNT': {
      console.log(`[DossierFacile Webhook] RETURNED_ACCOUNT for tenant ${tenantIdStr}`)
      await db
        .update(dossierFacileTenants)
        .set({ status: 'incomplete', updatedAt: new Date() })
        .where(eq(dossierFacileTenants.tenantId, tenantIdStr))
      console.log(`[DossierFacile Webhook] Tenant ${tenantIdStr} status set to incomplete`)
      return NextResponse.json({ ok: true })
    }

    case 'MERGED_ACCOUNT': {
      console.log(`[DossierFacile Webhook] MERGED_ACCOUNT for tenant ${tenantIdStr}`)
      await db
        .update(dossierFacileTenants)
        .set({ status: 'inactive', updatedAt: new Date() })
        .where(eq(dossierFacileTenants.tenantId, tenantIdStr))
      console.log(`[DossierFacile Webhook] Tenant ${tenantIdStr} status set to inactive`)
      return NextResponse.json({ ok: true })
    }

    default:
      console.warn(`[DossierFacile Webhook] Unknown callback type: ${partnerCallBackType} for tenant ${tenantIdStr}`)
      return NextResponse.json({ error: `Unknown callback type: ${partnerCallBackType}` }, { status: 400 })
  }
}
