import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { ZWebhookBodySchema } from '~/schemas/dossier-facile/dossier-facile-webhook'
import { db } from '~/server/db'
import { dossierFacileDocuments, dossierFacileTenants } from '~/server/db/schema'
import { normalizeStatus } from '~/server/services/dossier-facile/sync'
import { extractWebhookData } from '~/server/services/dossier-facile/webhook'

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

  const parsed = ZWebhookBodySchema.safeParse(body)
  if (!parsed.success) {
    console.warn('[DossierFacile Webhook] Invalid payload:', parsed.error.issues)
    return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
  }

  const { partnerCallBackType, onTenantId: tenantIdStr } = parsed.data

  // DELETED_ACCOUNT: delete the tenant row entirely
  if (partnerCallBackType === 'DELETED_ACCOUNT') {
    console.log(`[DossierFacile Webhook] DELETED_ACCOUNT for tenant ${tenantIdStr}`)
    await db.delete(dossierFacileTenants).where(eq(dossierFacileTenants.tenantId, tenantIdStr))
    console.log(`[DossierFacile Webhook] Tenant ${tenantIdStr} deleted successfully`)
    return NextResponse.json({ ok: true })
  }

  const now = new Date()

  try {
    const data = extractWebhookData(parsed.data)

    const [existingTenant] = await db
      .select({ id: dossierFacileTenants.id })
      .from(dossierFacileTenants)
      .where(eq(dossierFacileTenants.tenantId, tenantIdStr))
      .limit(1)

    if (!existingTenant) {
      console.warn(`[DossierFacile Webhook] Tenant ${tenantIdStr} not found in DB`)
      return NextResponse.json({ ok: true })
    }

    await db
      .update(dossierFacileTenants)
      .set({
        status: data.status,
        url: data.url,
        pdfUrl: data.pdfUrl,
        name: data.name,
        guarantorCount: data.guarantorCount,
        updatedAt: now,
        lastSyncedAt: now,
      })
      .where(eq(dossierFacileTenants.tenantId, tenantIdStr))

    if (data.documents.length > 0) {
      await db.delete(dossierFacileDocuments).where(eq(dossierFacileDocuments.tenantId, existingTenant.id))
      await db.insert(dossierFacileDocuments).values(
        data.documents.map((doc) => ({
          tenantId: existingTenant.id,
          ownerType: doc.ownerType,
          documentCategory: doc.documentCategory,
          documentSubCategory: doc.documentSubCategory,
          documentStatus: doc.documentStatus,
          url: doc.url,
        })),
      )
    }

    console.log(
      `[DossierFacile Webhook] ${partnerCallBackType} for tenant ${tenantIdStr} — status: ${data.status}, documents: ${data.documents.length}`,
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
