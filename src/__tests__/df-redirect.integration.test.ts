import { eq, sql } from 'drizzle-orm'
import { SignJWT } from 'jose'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BailleurPermission } from '~/server/bailleur/permissions'
import { dossierFacileApplications, dossierFacileTenants } from '../server/db/schema'
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
import { getTestDb } from './helpers/test-db'

// La route lit la session : hors contexte de requête Next, `headers()` n'existe pas. On simule donc
// le compte connecté, que chaque test peut basculer via `signedInAs`. La forme reproduit celle de
// `getServerSession`, qui enrichit la session du rôle et des autorisations bailleur : la route s'en
// sert pour vérifier `manage_applications`, qu'aucune garde tRPC ne tient ici.
let signedInAs: string | null = 'test-owner-id'
let signedInPermissions: BailleurPermission[] = ['manage_applications']
let signedInRole = 'owner'
vi.mock('~/services/better-auth', async () => {
  const actual = await vi.importActual<typeof import('~/services/better-auth')>('~/services/better-auth')
  return {
    ...actual,
    getServerSession: async () =>
      signedInAs ? { user: { id: signedInAs, role: signedInRole, bailleurRole: null, bailleurPermissions: signedInPermissions } } : null,
  }
})

beforeEach(async () => {
  signedInAs = 'test-owner-id'
  signedInPermissions = ['manage_applications']
  signedInRole = 'owner'
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

  it('grants access to a tenant who also applied to another owner, whatever the row order', async () => {
    // Candidature chez un autre bailleur insérée en premier : un `findFirst` non filtré par bailleur la
    // renverrait, et l'accès serait refusé à tort.
    await createUser({ id: 'other-owner-user', name: 'Other', email: 'other-owner@test.com', role: 'owner' })
    const otherOwner = await createOwner({ name: 'Other Owner Shared', slug: 'other-owner-shared', userId: 'other-owner-user' })
    const otherAccommodation = await createAccommodation({ slug: 'res-other-shared', ownerId: otherOwner.id })
    const tenant = await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-shared-1', status: 'verified' })
    await createDossierFacileApplication({ tenantId: tenant.id, accommodationSlug: otherAccommodation.slug, apartmentType: 't1' })
    const owner = await createOwner({ name: 'Owner Shared', slug: 'owner-shared', userId: 'test-owner-id' })
    const accommodation = await createAccommodation({ slug: 'res-owner-shared', ownerId: owner.id })
    await createDossierFacileApplication({ tenantId: tenant.id, accommodationSlug: accommodation.slug, apartmentType: 't1' })

    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(ownerCaller.bailleur.getDocumentSignedUrl({ type: 'tenantPdf', tenantId: tenant.id })).resolves.toMatchObject({
        redirectUrl: expect.stringMatching(/^\/api\/df-redirect\?token=/),
      })
    }
  })

  it('rejects when owner does not own the accommodation', async () => {
    const otherOwner = await createOwner({ name: 'Other Owner', slug: 'other-owner-df', userId: 'test-admin-id' })
    const accommodation = await createAccommodation({ slug: 'res-other-df', ownerId: otherOwner.id })
    const tenant = await createDossierFacileTenant({ userId: 'test-user-id', tenantId: 'df-other-1', status: 'verified' })
    await createDossierFacileApplication({ tenantId: tenant.id, accommodationSlug: accommodation.slug, apartmentType: 't1' })

    // NOT_FOUND et non FORBIDDEN : la candidature d'un autre bailleur n'est même pas trouvée, ce qui ne
    // révèle pas que ce locataire a candidaté ailleurs.
    await expect(ownerCaller.bailleur.getDocumentSignedUrl({ type: 'tenantPdf', tenantId: tenant.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
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

// ─── Le jeton n'est pas une autorisation ────────────────────────────────────

describe('/api/df-redirect is not a bearer token', () => {
  it('refuses a valid token presented without a session', async () => {
    const { tenant } = await createTestData()
    const { redirectUrl } = await ownerCaller.bailleur.getDocumentSignedUrl({ type: 'tenantPdf', tenantId: tenant.id })
    const token = new URL(redirectUrl, 'http://localhost').searchParams.get('token')!

    signedInAs = null
    const res = await callRedirect(token)

    expect(res.headers.get('location')).toContain('error_type=doc_forbidden')
  })

  it('refuses a token issued to somebody else', async () => {
    const { tenant } = await createTestData()
    const { redirectUrl } = await ownerCaller.bailleur.getDocumentSignedUrl({ type: 'tenantPdf', tenantId: tenant.id })
    const token = new URL(redirectUrl, 'http://localhost').searchParams.get('token')!

    // Jeton intercepté : le `sub` ne correspond plus au compte qui le présente.
    signedInAs = 'test-owner-id-2'
    await createUser({ id: 'test-owner-id-2', name: 'Autre', email: 'autre@test.com', role: 'owner' })
    const res = await callRedirect(token)

    expect(res.headers.get('location')).toContain('error_type=doc_forbidden')
  })

  it('refuses a bailleur account that lacks manage_applications', async () => {
    const { tenant } = await createTestData()
    const { redirectUrl } = await ownerCaller.bailleur.getDocumentSignedUrl({ type: 'tenantPdf', tenantId: tenant.id })
    const token = new URL(redirectUrl, 'http://localhost').searchParams.get('token')!

    // La route n'a aucune garde d'autorisation en amont : c'est elle qui doit la tenir.
    signedInPermissions = []

    const res = await callRedirect(token)

    expect(res.headers.get('location')).toContain('error_type=doc_forbidden')
  })

  it('refuses once the candidature has left the retention window', async () => {
    const { tenant, application } = await createTestData()
    const { redirectUrl } = await ownerCaller.bailleur.getDocumentSignedUrl({ type: 'tenantPdf', tenantId: tenant.id })
    const token = new URL(redirectUrl, 'http://localhost').searchParams.get('token')!

    // Le jeton a été émis alors que la candidature était visible ; elle ne l'est plus.
    await getTestDb()
      .update(dossierFacileApplications)
      .set({ createdAt: sql`now() - '31 days'::interval` })
      .where(eq(dossierFacileApplications.id, application.id))

    const res = await callRedirect(token)

    expect(res.headers.get('location')).toContain('error_type=doc_forbidden')
  })

  it('refuses once the dossier is no longer verified', async () => {
    const { tenant } = await createTestData()
    const { redirectUrl } = await ownerCaller.bailleur.getDocumentSignedUrl({ type: 'tenantPdf', tenantId: tenant.id })
    const token = new URL(redirectUrl, 'http://localhost').searchParams.get('token')!

    await getTestDb().update(dossierFacileTenants).set({ status: 'denied' }).where(eq(dossierFacileTenants.id, tenant.id))

    const res = await callRedirect(token)

    expect(res.headers.get('location')).toContain('error_type=doc_forbidden')
  })
})
