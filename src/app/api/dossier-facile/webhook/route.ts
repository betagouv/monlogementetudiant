import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '~/server/db'
import { dossierFacileDocuments, dossierFacileTenants } from '~/server/db/schema'
import { extractWebhookData, normalizeStatus } from '~/server/services/dossier-facile'

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

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    console.warn('[DossierFacile Webhook] Failed to parse JSON body')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  console.log('[DossierFacile Webhook] Received:', JSON.stringify(body))

  const partnerCallBackType = body.partnerCallBackType as string | undefined
  const tenantId = body.onTenantId as string | number | undefined
  if (!partnerCallBackType || !tenantId) {
    console.warn('[DossierFacile Webhook] Missing partnerCallBackType or tenantId')
    return NextResponse.json({ error: 'Missing partnerCallBackType or tenantId' }, { status: 400 })
  }

  const tenantIdStr = String(tenantId)

  // DELETED_ACCOUNT: delete the tenant row entirely
  if (partnerCallBackType === 'DELETED_ACCOUNT') {
    console.log(`[DossierFacile Webhook] DELETED_ACCOUNT for tenant ${tenantIdStr}`)
    await db.delete(dossierFacileTenants).where(eq(dossierFacileTenants.tenantId, tenantIdStr))
    console.log(`[DossierFacile Webhook] Tenant ${tenantIdStr} deleted successfully`)
    return NextResponse.json({ ok: true })
  }

  // For all other callback types, try to extract full data from webhook body
  const now = new Date()

  try {
    const data = extractWebhookData(body)

    // Determine status: use extracted status if available, otherwise fall back to normalizing the callback type
    const status = data.status ?? normalizeStatus(partnerCallBackType)

    // Find existing tenant row
    const [existingTenant] = await db
      .select({ id: dossierFacileTenants.id })
      .from(dossierFacileTenants)
      .where(eq(dossierFacileTenants.tenantId, tenantIdStr))
      .limit(1)

    if (!existingTenant) {
      console.warn(`[DossierFacile Webhook] Tenant ${tenantIdStr} not found in DB`)
      return NextResponse.json({ ok: true })
    }

    // Update tenant data
    const updateSet: Record<string, unknown> = {
      status,
      updatedAt: now,
      lastSyncedAt: now,
    }
    if (data.url) updateSet.url = data.url
    if (data.pdfUrl) updateSet.pdfUrl = data.pdfUrl
    if (data.name) updateSet.name = data.name
    if (data.guarantorCount > 0) updateSet.guarantorCount = data.guarantorCount

    await db.update(dossierFacileTenants).set(updateSet).where(eq(dossierFacileTenants.tenantId, tenantIdStr))

    // Replace documents if any were extracted
    if (data.documents.length > 0) {
      await db.delete(dossierFacileDocuments).where(eq(dossierFacileDocuments.tenantId, existingTenant.id))
      await db.insert(dossierFacileDocuments).values(
        data.documents.map((doc) => ({
          tenantId: existingTenant.id,
          ownerType: doc.ownerType,
          documentCategory: doc.documentCategory,
          documentSubCategory: doc.documentSubCategory,
          documentStatus: doc.documentStatus,
          monthlySum: doc.monthlySum,
        })),
      )
    }

    console.log(
      `[DossierFacile Webhook] ${partnerCallBackType} for tenant ${tenantIdStr} — status: ${status}, documents: ${data.documents.length}`,
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    // Fallback: just update status from callback type
    console.error(`[DossierFacile Webhook] Error extracting data for ${tenantIdStr}, falling back to status-only update:`, error)

    const fallbackStatus = normalizeStatus(partnerCallBackType)
    if (fallbackStatus) {
      await db
        .update(dossierFacileTenants)
        .set({ status: fallbackStatus, updatedAt: now })
        .where(eq(dossierFacileTenants.tenantId, tenantIdStr))
    }

    return NextResponse.json({ ok: true })
  }
}
