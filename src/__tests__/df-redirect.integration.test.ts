import { SignJWT } from 'jose'
import { beforeEach, describe, expect, it } from 'vitest'
import { getJwtSecret } from '../server/utils/jwt-secret'
import {
  createAccommodation,
  createDossierFacileApplication,
  createDossierFacileDocument,
  createDossierFacileTenant,
  createOwner,
  createUser,
} from './fixtures/factories'
import './helpers/setup-integration'
import { adminCaller, authenticatedCaller, caller, ownerCaller } from './helpers/test-caller'

beforeEach(async () => {
  await createUser({ id: 'test-user-id', name: 'Test User', email: 'test@test.com', role: 'user' })
  await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
  await createUser({ id: 'test-admin-id', name: 'Test Admin', email: 'admin@test.com', role: 'admin' })
})

async function callRedirect(token: string) {
  const { GET } = await import('../app/api/df-redirect/route')
  return GET(new Request(`http://localhost/api/df-redirect?token=${token}`))
}

async function createTestData(overrides?: { pdfUrl?: string | null; tenantUrl?: string | null }) {
  const owner = await createOwner({ name: 'Owner DF', slug: 'owner-df', userId: 'test-owner-id' })
  const accommodation = await createAccommodation({ slug: 'res-df-test', ownerId: owner.id })
  const tenant = await createDossierFacileTenant({
    userId: 'test-user-id',
    tenantId: 'df-redirect-1',
    status: 'verified',
    pdfUrl: overrides?.pdfUrl !== undefined ? overrides.pdfUrl : 'https://dossierfacile.example.com/doc/12345.pdf',
    url: overrides?.tenantUrl !== undefined ? overrides.tenantUrl : 'https://dossierfacile.example.com/tenant/12345',
  })
  const application = await createDossierFacileApplication({
    tenantId: tenant.id,
    accommodationSlug: accommodation.slug,
    apartmentType: 't1',
  })
  return { owner, accommodation, tenant, application }
}

// ─── getCandidature ne doit plus exposer d'URL directe ──────────────────────

describe('getCandidature does not expose raw URLs', () => {
  it('returns dfTenantId, hasPdfUrl and hasTenantUrl instead of raw URLs', async () => {
    const { tenant } = await createTestData()

    const candidature = await ownerCaller.bailleur.getCandidature({
      id: (await ownerCaller.bailleur.listCandidatures({ page: 1 })).items[0].id,
    })

    // Must NOT contain raw URLs
    expect(candidature).not.toHaveProperty('tenantUrl')
    expect(candidature).not.toHaveProperty('pdfUrl')

    // Must contain opaque identifiers
    expect(candidature.dfTenantId).toBe(tenant.id)
    expect(candidature.hasPdfUrl).toBe(true)
    expect(candidature.hasTenantUrl).toBe(true)
  })

  it('returns hasPdfUrl=false when no PDF URL', async () => {
    await createTestData({ pdfUrl: null })

    const list = await ownerCaller.bailleur.listCandidatures({ page: 1 })
    const candidature = await ownerCaller.bailleur.getCandidature({ id: list.items[0].id })

    expect(candidature.hasPdfUrl).toBe(false)
  })

  it('strips url field from document objects', async () => {
    const { tenant } = await createTestData()
    await createDossierFacileDocument({
      tenantId: tenant.id,
      ownerType: 'tenant',
      documentCategory: 'IDENTIFICATION',
      url: 'https://dossierfacile.example.com/doc/secret.pdf',
    })

    const list = await ownerCaller.bailleur.listCandidatures({ page: 1 })
    const candidature = await ownerCaller.bailleur.getCandidature({ id: list.items[0].id })

    expect(candidature.documents.tenant.length).toBeGreaterThan(0)
    for (const doc of candidature.documents.tenant) {
      expect(doc).not.toHaveProperty('url')
      expect(doc).toHaveProperty('id')
    }
  })
})

// ─── listCandidatures ne doit plus exposer pdfUrl ───────────────────────────

describe('listCandidatures does not expose pdfUrl', () => {
  it('does not include pdfUrl in list items', async () => {
    await createTestData()

    const list = await ownerCaller.bailleur.listCandidatures({ page: 1 })
    expect(list.items.length).toBeGreaterThan(0)
    for (const item of list.items) {
      expect(item).not.toHaveProperty('pdfUrl')
    }
  })
})

// ─── getDocumentSignedUrl mutation ──────────────────────────────────────────

describe('getDocumentSignedUrl', () => {
  it('rejects unauthenticated users', async () => {
    await expect(caller.bailleur.getDocumentSignedUrl({ type: 'tenantPdf', tenantId: crypto.randomUUID() })).rejects.toThrow('UNAUTHORIZED')
  })

  it('rejects non-owner users', async () => {
    await expect(authenticatedCaller.bailleur.getDocumentSignedUrl({ type: 'tenantPdf', tenantId: crypto.randomUUID() })).rejects.toThrow()
  })

  it('returns a signed redirect URL for tenantPdf', async () => {
    const { tenant } = await createTestData()

    const result = await ownerCaller.bailleur.getDocumentSignedUrl({ type: 'tenantPdf', tenantId: tenant.id })

    expect(result.redirectUrl).toMatch(/^\/api\/df-redirect\?token=/)
  })

  it('returns a signed redirect URL for tenantUrl', async () => {
    const { tenant } = await createTestData()

    const result = await ownerCaller.bailleur.getDocumentSignedUrl({ type: 'tenantUrl', tenantId: tenant.id })

    expect(result.redirectUrl).toMatch(/^\/api\/df-redirect\?token=/)
  })

  it('returns a signed redirect URL for a document', async () => {
    const { tenant } = await createTestData()
    const doc = await createDossierFacileDocument({
      tenantId: tenant.id,
      url: 'https://dossierfacile.example.com/doc/abc.pdf',
    })

    const result = await ownerCaller.bailleur.getDocumentSignedUrl({ type: 'document', documentId: doc.id })

    expect(result.redirectUrl).toMatch(/^\/api\/df-redirect\?token=/)
  })

  it('rejects when owner does not own the accommodation', async () => {
    const otherOwner = await createOwner({ name: 'Other Owner', slug: 'other-owner-df', userId: 'test-admin-id' })
    const accommodation = await createAccommodation({ slug: 'res-other-df', ownerId: otherOwner.id })
    const tenant = await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-other-1', status: 'verified' })
    await createDossierFacileApplication({ tenantId: tenant.id, accommodationSlug: accommodation.slug, apartmentType: 't1' })

    await expect(ownerCaller.bailleur.getDocumentSignedUrl({ type: 'tenantPdf', tenantId: tenant.id })).rejects.toThrow(
      'You do not own this accommodation',
    )
  })

  it('admin can access any document', async () => {
    const { tenant } = await createTestData()

    const result = await adminCaller.bailleur.getDocumentSignedUrl({ type: 'tenantPdf', tenantId: tenant.id })

    expect(result.redirectUrl).toMatch(/^\/api\/df-redirect\?token=/)
  })
})

// ─── /api/df-redirect route ─────────────────────────────────────────────────

describe('/api/df-redirect', () => {
  it('redirects to the real PDF URL with a valid token', async () => {
    const { tenant } = await createTestData()

    const { redirectUrl } = await ownerCaller.bailleur.getDocumentSignedUrl({ type: 'tenantPdf', tenantId: tenant.id })
    const token = new URL(redirectUrl, 'http://localhost').searchParams.get('token')!

    const res = await callRedirect(token)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://dossierfacile.example.com/doc/12345.pdf')
  })

  it('redirects to the tenant URL with a valid token', async () => {
    const { tenant } = await createTestData()

    const { redirectUrl } = await ownerCaller.bailleur.getDocumentSignedUrl({ type: 'tenantUrl', tenantId: tenant.id })
    const token = new URL(redirectUrl, 'http://localhost').searchParams.get('token')!

    const res = await callRedirect(token)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://dossierfacile.example.com/tenant/12345')
  })

  it('redirects to a document URL with a valid token', async () => {
    const { tenant } = await createTestData()
    const doc = await createDossierFacileDocument({
      tenantId: tenant.id,
      url: 'https://dossierfacile.example.com/doc/specific.pdf',
    })

    const { redirectUrl } = await ownerCaller.bailleur.getDocumentSignedUrl({ type: 'document', documentId: doc.id })
    const token = new URL(redirectUrl, 'http://localhost').searchParams.get('token')!

    const res = await callRedirect(token)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://dossierfacile.example.com/doc/specific.pdf')
  })

  it('redirects to error page with an expired token', async () => {
    const { tenant } = await createTestData()

    const token = await new SignJWT({ urlType: 'tenantPdf', targetId: tenant.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('test-owner-id')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 70)
      .sign(getJwtSecret())

    const res = await callRedirect(token)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/dossier-facile/error?error_type=doc_expired')
  })

  it('redirects to error page with a tampered token', async () => {
    const { tenant } = await createTestData()

    const { redirectUrl } = await ownerCaller.bailleur.getDocumentSignedUrl({ type: 'tenantPdf', tenantId: tenant.id })
    const token = new URL(redirectUrl, 'http://localhost').searchParams.get('token')!

    const tamperedToken = token.slice(0, -5) + 'XXXXX'
    const res = await callRedirect(tamperedToken)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/dossier-facile/error?error_type=doc_expired')
  })

  it('redirects to error page with missing token', async () => {
    const { GET } = await import('../app/api/df-redirect/route')
    const res = await GET(new Request('http://localhost/api/df-redirect'))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/dossier-facile/error?error_type=doc_invalid_link')
  })

  it('redirects to error page when document does not exist', async () => {
    const nonExistentId = crypto.randomUUID()
    const token = await new SignJWT({ urlType: 'document', targetId: nonExistentId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('test-owner-id')
      .setExpirationTime('60s')
      .setIssuedAt()
      .sign(getJwtSecret())

    const res = await callRedirect(token)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/dossier-facile/error?error_type=doc_not_found')
  })
})
