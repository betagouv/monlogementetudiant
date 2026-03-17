import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dossierFacileApplications, dossierFacileTenants } from '../server/db/schema'
import { createAccommodation, createDossierFacileApplication, createDossierFacileTenant, createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { authenticatedCaller, caller, ownerCaller } from './helpers/test-caller'
import { getTestDb } from './helpers/test-db'

const WEBHOOK_API_KEY = 'test-webhook-secret'

function webhookRequest(body: unknown, apiKey?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey !== undefined) {
    headers['X-Api-Key'] = apiKey
  }
  return new Request('http://localhost/api/dossier-facile/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

async function callWebhook(body: unknown, apiKey: string = WEBHOOK_API_KEY) {
  const { POST } = await import('../app/api/dossier-facile/webhook/route')
  return POST(webhookRequest(body, apiKey))
}

beforeEach(async () => {
  vi.stubEnv('DOSSIERFACILE_WEBHOOK_API_KEY', WEBHOOK_API_KEY)
  await createUser({ id: 'test-user-id', name: 'Test User', email: 'test@test.com', role: 'user' })
  await createUser({ id: 'test-user-id-2', name: 'Test User 2', email: 'test2@test.com', role: 'user' })
  await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
})

// ─── Webhook endpoint tests ───────────────────────────────────────────────────

describe('DossierFacile Webhook', () => {
  describe('authentication', () => {
    it('returns 401 with invalid API key', async () => {
      const res = await callWebhook({ partnerCallBackType: 'VERIFIED_ACCOUNT', onTenantId: '123' }, 'wrong-key')
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.error).toBe('Unauthorized')
    })

    it('returns 401 with missing API key', async () => {
      const { POST } = await import('../app/api/dossier-facile/webhook/route')
      const req = new Request('http://localhost/api/dossier-facile/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerCallBackType: 'VERIFIED_ACCOUNT', onTenantId: '123' }),
      })
      const res = await POST(req)
      expect(res.status).toBe(401)
    })

    it('returns 500 when DOSSIERFACILE_WEBHOOK_API_KEY is not configured', async () => {
      vi.stubEnv('DOSSIERFACILE_WEBHOOK_API_KEY', '')
      const { POST } = await import('../app/api/dossier-facile/webhook/route')
      const req = new Request('http://localhost/api/dossier-facile/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': 'any' },
        body: JSON.stringify({ partnerCallBackType: 'VERIFIED_ACCOUNT', onTenantId: '123' }),
      })
      const res = await POST(req)
      expect(res.status).toBe(500)
    })
  })

  describe('validation', () => {
    it('returns 400 when body is not valid JSON', async () => {
      const { POST } = await import('../app/api/dossier-facile/webhook/route')
      const req = new Request('http://localhost/api/dossier-facile/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': WEBHOOK_API_KEY },
        body: 'not json',
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Invalid JSON')
    })

    it('returns 400 when partnerCallBackType is missing', async () => {
      const res = await callWebhook({ onTenantId: '123' })
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('Invalid webhook payload')
    })

    it('returns 400 when onTenantId is missing', async () => {
      const res = await callWebhook({ partnerCallBackType: 'VERIFIED_ACCOUNT' })
      expect(res.status).toBe(400)
    })
  })

  describe('VERIFIED_ACCOUNT', () => {
    it('sets tenant status to verified', async () => {
      const tenant = await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-100', status: 'pending' })

      const res = await callWebhook({ partnerCallBackType: 'VERIFIED_ACCOUNT', onTenantId: 'df-100' })
      expect(res.status).toBe(200)

      const db = getTestDb()
      const updated = await db.query.dossierFacileTenants.findFirst({
        where: eq(dossierFacileTenants.id, tenant.id),
      })
      expect(updated!.status).toBe('verified')
    })

    it('handles numeric onTenantId', async () => {
      await createDossierFacileTenant({ userId: 'test-user-id', tenantId: '42', status: 'pending' })

      const res = await callWebhook({ partnerCallBackType: 'VERIFIED_ACCOUNT', onTenantId: 42 })
      expect(res.status).toBe(200)

      const db = getTestDb()
      const updated = await db.query.dossierFacileTenants.findFirst({
        where: eq(dossierFacileTenants.tenantId, '42'),
      })
      expect(updated!.status).toBe('verified')
    })
  })

  describe('DENIED_ACCOUNT', () => {
    it('sets tenant status to denied', async () => {
      const tenant = await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-200', status: 'verified' })

      const res = await callWebhook({ partnerCallBackType: 'DENIED_ACCOUNT', onTenantId: 'df-200' })
      expect(res.status).toBe(200)

      const db = getTestDb()
      const updated = await db.query.dossierFacileTenants.findFirst({
        where: eq(dossierFacileTenants.id, tenant.id),
      })
      expect(updated!.status).toBe('denied')
    })
  })

  describe('ACCESS_REVOKED', () => {
    it('sets tenant status to access_revoked', async () => {
      const tenant = await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-300', status: 'verified' })

      const res = await callWebhook({ partnerCallBackType: 'ACCESS_REVOKED', onTenantId: 'df-300' })
      expect(res.status).toBe(200)

      const db = getTestDb()
      const updated = await db.query.dossierFacileTenants.findFirst({
        where: eq(dossierFacileTenants.id, tenant.id),
      })
      expect(updated!.status).toBe('access_revoked')
    })
  })

  describe('CREATED_ACCOUNT', () => {
    it('sets tenant status to to_process', async () => {
      const tenant = await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-500', status: 'incomplete' })

      const res = await callWebhook({ partnerCallBackType: 'CREATED_ACCOUNT', onTenantId: 'df-500' })
      expect(res.status).toBe(200)

      const db = getTestDb()
      const updated = await db.query.dossierFacileTenants.findFirst({
        where: eq(dossierFacileTenants.id, tenant.id),
      })
      expect(updated!.status).toBe('to_process')
    })
  })

  describe('APPLICATION_TYPE_CHANGED', () => {
    it('sets tenant status to incomplete', async () => {
      const tenant = await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-600', status: 'verified' })

      const res = await callWebhook({ partnerCallBackType: 'APPLICATION_TYPE_CHANGED', onTenantId: 'df-600' })
      expect(res.status).toBe(200)

      const db = getTestDb()
      const updated = await db.query.dossierFacileTenants.findFirst({
        where: eq(dossierFacileTenants.id, tenant.id),
      })
      expect(updated!.status).toBe('incomplete')
    })
  })

  describe('ARCHIVED_ACCOUNT', () => {
    it('sets tenant status to inactive', async () => {
      const tenant = await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-700', status: 'verified' })

      const res = await callWebhook({ partnerCallBackType: 'ARCHIVED_ACCOUNT', onTenantId: 'df-700' })
      expect(res.status).toBe(200)

      const db = getTestDb()
      const updated = await db.query.dossierFacileTenants.findFirst({
        where: eq(dossierFacileTenants.id, tenant.id),
      })
      expect(updated!.status).toBe('inactive')
    })
  })

  describe('RETURNED_ACCOUNT', () => {
    it('sets tenant status to incomplete', async () => {
      const tenant = await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-800', status: 'inactive' })

      const res = await callWebhook({ partnerCallBackType: 'RETURNED_ACCOUNT', onTenantId: 'df-800' })
      expect(res.status).toBe(200)

      const db = getTestDb()
      const updated = await db.query.dossierFacileTenants.findFirst({
        where: eq(dossierFacileTenants.id, tenant.id),
      })
      expect(updated!.status).toBe('incomplete')
    })
  })

  describe('MERGED_ACCOUNT', () => {
    it('sets tenant status to inactive', async () => {
      const tenant = await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-900', status: 'verified' })

      const res = await callWebhook({ partnerCallBackType: 'MERGED_ACCOUNT', onTenantId: 'df-900' })
      expect(res.status).toBe(200)

      const db = getTestDb()
      const updated = await db.query.dossierFacileTenants.findFirst({
        where: eq(dossierFacileTenants.id, tenant.id),
      })
      expect(updated!.status).toBe('inactive')
    })
  })

  describe('DELETED_ACCOUNT', () => {
    it('deletes the tenant record', async () => {
      await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-400', status: 'verified' })

      const res = await callWebhook({ partnerCallBackType: 'DELETED_ACCOUNT', onTenantId: 'df-400' })
      expect(res.status).toBe(200)

      const db = getTestDb()
      const deleted = await db.query.dossierFacileTenants.findFirst({
        where: eq(dossierFacileTenants.tenantId, 'df-400'),
      })
      expect(deleted).toBeUndefined()
    })

    it('cascades deletion to applications', async () => {
      const tenant = await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-401', status: 'verified' })
      await createAccommodation({ slug: 'residence-cascade' })
      await createDossierFacileApplication({
        tenantId: tenant.id,
        accommodationSlug: 'residence-cascade',
        apartmentType: 't2',
      })

      const res = await callWebhook({ partnerCallBackType: 'DELETED_ACCOUNT', onTenantId: 'df-401' })
      expect(res.status).toBe(200)

      const db = getTestDb()
      const apps = await db.query.dossierFacileApplications.findMany({
        where: eq(dossierFacileApplications.tenantId, tenant.id),
      })
      expect(apps).toHaveLength(0)
    })

    it('succeeds even if tenant does not exist', async () => {
      const res = await callWebhook({ partnerCallBackType: 'DELETED_ACCOUNT', onTenantId: 'nonexistent' })
      expect(res.status).toBe(200)
    })
  })
})

// ─── tRPC procedure tests ─────────────────────────────────────────────────────

describe('DossierFacile tRPC', () => {
  describe('dossierFacile.tenant', () => {
    it('returns null when no tenant linked', async () => {
      const result = await authenticatedCaller.dossierFacile.tenant()
      expect(result).toBeNull()
    })

    it('returns the tenant for the authenticated user', async () => {
      await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-t-1', status: 'verified', name: 'Alice' })

      const result = await authenticatedCaller.dossierFacile.tenant()
      expect(result).not.toBeNull()
      expect(result!.tenantId).toBe('df-t-1')
      expect(result!.name).toBe('Alice')
    })

    it('does not return tenants belonging to other users', async () => {
      await createDossierFacileTenant({ userId: 'test-user-id-2', tenantId: 'df-t-other', status: 'verified' })

      const result = await authenticatedCaller.dossierFacile.tenant()
      expect(result).toBeNull()
    })
  })

  describe('dossierFacile.listApplications', () => {
    it('returns null when no tenant linked', async () => {
      const result = await authenticatedCaller.dossierFacile.listApplications({ accommodationSlug: 'any' })
      expect(result).toBeNull()
    })

    it('returns null when no application for the slug', async () => {
      await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-la-1', status: 'verified' })

      const result = await authenticatedCaller.dossierFacile.listApplications({ accommodationSlug: 'unknown-slug' })
      expect(result).toBeNull()
    })

    it('returns the application for the given slug', async () => {
      const tenant = await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-la-2', status: 'verified' })
      await createAccommodation({ slug: 'res-app' })
      await createDossierFacileApplication({
        tenantId: tenant.id,
        accommodationSlug: 'res-app',
        apartmentType: 't1',
      })

      const result = await authenticatedCaller.dossierFacile.listApplications({ accommodationSlug: 'res-app' })
      expect(result).not.toBeNull()
      expect(result!.accommodationSlug).toBe('res-app')
      expect(result!.apartmentType).toBe('t1')
    })
  })

  describe('dossierFacile.application', () => {
    it('rejects unauthenticated users', async () => {
      await expect(caller.dossierFacile.application({ accommodationSlug: 'x', apartmentType: 't1' })).rejects.toThrow('UNAUTHORIZED')
    })

    it('rejects non-user roles', async () => {
      await expect(ownerCaller.dossierFacile.application({ accommodationSlug: 'x', apartmentType: 't1' })).rejects.toThrow(
        'Student or admin role required',
      )
    })

    it('rejects when no tenant is linked', async () => {
      await expect(authenticatedCaller.dossierFacile.application({ accommodationSlug: 'x', apartmentType: 't1' })).rejects.toThrow(
        'No DossierFacile tenant linked',
      )
    })

    it('rejects when tenant is not verified', async () => {
      await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-app-1', status: 'pending' })
      await createAccommodation({ slug: 'res-unverified', nbT1Available: 5 })

      await expect(
        authenticatedCaller.dossierFacile.application({ accommodationSlug: 'res-unverified', apartmentType: 't1' }),
      ).rejects.toThrow('Tenant dossier is not verified')
    })

    it('rejects when accommodation does not exist', async () => {
      await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-app-2', status: 'verified' })

      await expect(
        authenticatedCaller.dossierFacile.application({ accommodationSlug: 'nonexistent', apartmentType: 't1' }),
      ).rejects.toThrow('Accommodation not found')
    })

    it('rejects when apartment type is not available', async () => {
      await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-app-3', status: 'verified' })
      await createAccommodation({ slug: 'res-no-avail', nbT1Available: 0 })

      await expect(
        authenticatedCaller.dossierFacile.application({ accommodationSlug: 'res-no-avail', apartmentType: 't1' }),
      ).rejects.toThrow('This apartment type is not available')
    })

    it('creates an application successfully', async () => {
      await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-app-4', status: 'verified' })
      await createAccommodation({ slug: 'res-apply', nbT2Available: 3 })

      const result = await authenticatedCaller.dossierFacile.application({
        accommodationSlug: 'res-apply',
        apartmentType: 't2',
      })
      expect(result).not.toBeNull()
      expect(result!.accommodationSlug).toBe('res-apply')
      expect(result!.apartmentType).toBe('t2')
    })

    it('returns null on duplicate application (conflict do nothing)', async () => {
      await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-app-5', status: 'verified' })
      await createAccommodation({ slug: 'res-dup', nbT1Available: 5 })

      await authenticatedCaller.dossierFacile.application({ accommodationSlug: 'res-dup', apartmentType: 't1' })
      const second = await authenticatedCaller.dossierFacile.application({
        accommodationSlug: 'res-dup',
        apartmentType: 't1',
      })
      expect(second).toBeNull()
    })
  })
})
