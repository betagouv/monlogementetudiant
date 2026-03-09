import { db } from '~/server/db'
import { dossierFacileTenants } from '~/server/db/schema'

const REQUIRED_ENV_VARS = [
  'DOSSIERFACILE_CLIENT_ID',
  'DOSSIERFACILE_CLIENT_SECRET',
  'DOSSIERFACILE_AUTHORIZE_URL',
  'DOSSIERFACILE_TOKEN_URL',
  'DOSSIERFACILE_TENANT_PROFILE_URL',
  'DOSSIERFACILE_REDIRECT_URI',
] as const

export class DossierFacileError extends Error {
  constructor(
    message: string,
    public errorType: string,
    public statusCode: number = 502,
  ) {
    super(message)
  }
}

export function validateConfig() {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name])
  if (missing.length > 0) {
    throw new Error(`Missing DossierFacile env vars: ${missing.join(', ')}`)
  }
}

export function buildAuthorizationUrl(state: string, loginHint?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.DOSSIERFACILE_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.DOSSIERFACILE_REDIRECT_URI!,
    scope: process.env.DOSSIERFACILE_SCOPE || 'openid',
    state,
  })
  if (loginHint) {
    params.set('login_hint', loginHint)
  }
  return `${process.env.DOSSIERFACILE_AUTHORIZE_URL}?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  let response: Response
  try {
    const credentials = btoa(`${process.env.DOSSIERFACILE_CLIENT_ID}:${process.env.DOSSIERFACILE_CLIENT_SECRET}`)
    response = await fetch(process.env.DOSSIERFACILE_TOKEN_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DOSSIERFACILE_REDIRECT_URI!,
      }),
    })
  } catch {
    throw new DossierFacileError('Unable to reach DossierFacile token endpoint.', 'dossier_facile_token_endpoint_unreachable', 502)
  }

  const payload = await safeJson(response)
  if (!response.ok) {
    throw new DossierFacileError(
      (payload.error_description as string) || 'Unable to exchange DossierFacile authorization code.',
      'dossier_facile_token_exchange_failed',
      response.status === 400 || response.status === 401 ? 400 : 502,
    )
  }

  const accessToken = payload.access_token
  if (!accessToken) {
    throw new DossierFacileError('DossierFacile did not return an access token.', 'dossier_facile_invalid_token_response', 502)
  }

  return accessToken as string
}

export async function getUserDossier(accessToken: string): Promise<Record<string, unknown>> {
  let response: Response
  try {
    response = await fetch(process.env.DOSSIERFACILE_TENANT_PROFILE_URL!, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new DossierFacileError('Unable to reach DossierFacile profile endpoint.', 'dossier_facile_profile_endpoint_unreachable', 502)
  }

  const payload = await safeJson(response)
  if (!response.ok) {
    throw new DossierFacileError(
      (payload.error_description as string) || 'Unable to fetch DossierFacile dossier.',
      'dossier_facile_profile_fetch_failed',
      502,
    )
  }

  return payload
}

export function normalizeStatus(raw: string | null | undefined): string | null {
  if (!raw) return null

  let normalized = raw.trim().toLowerCase().replace(/-/g, '_').replace(/ /g, '_')

  const aliases: Record<string, string> = {
    validated: 'verified',
    verified_account: 'verified',
    deleted_account: 'access_revoked',
    declined: 'denied',
    archived: 'inactive',
  }
  normalized = aliases[normalized] ?? normalized

  const allowed = new Set(['verified', 'denied', 'access_revoked', 'active', 'inactive', 'to_process', 'incomplete'])
  return allowed.has(normalized) ? normalized : null
}

export function extractTenantId(profile: Record<string, unknown>): string | null {
  for (const key of ['connectedTenantId', 'id', 'tenant_id', 'tenantId', 'sub']) {
    const value = profile[key]
    if (value) return String(value)
  }

  const apartmentSharing = profile.apartmentSharing
  if (apartmentSharing && typeof apartmentSharing === 'object') {
    const sharing = apartmentSharing as Record<string, unknown>
    for (const key of ['tenantId', 'tenant_id', 'id']) {
      const value = sharing[key]
      if (value) return String(value)
    }
  }

  return null
}

export function extractTenantName(profile: Record<string, unknown>, user: { firstname: string; lastname: string; email: string }): string {
  for (const key of ['fullName', 'name']) {
    const value = profile[key]
    if (value) return String(value)
  }

  const firstName = profile.firstName as string | undefined
  const lastName = profile.lastName as string | undefined
  if (firstName || lastName) {
    return `${firstName || ''} ${lastName || ''}`.trim()
  }

  const fullName = `${user.firstname} ${user.lastname}`.trim()
  if (fullName) return fullName

  return user.email
}

export function extractSharingData(profile: Record<string, unknown>): {
  status: string | null
  url: string | null
  pdfUrl: string | null
} {
  const raw = profile.apartmentSharing
  const apartmentSharing = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : ({} as Record<string, unknown>)

  return {
    status: normalizeStatus((apartmentSharing.status as string) || (profile.status as string) || null),
    url: (apartmentSharing.dossierUrl as string) || (profile.dossierUrl as string) || null,
    pdfUrl: (apartmentSharing.dossierPdfUrl as string) || (profile.dossierPdfUrl as string) || null,
  }
}

export async function syncTenantFromProfile(
  userId: string,
  profile: Record<string, unknown>,
  user: { firstname: string; lastname: string; email: string },
) {
  const tenantId = extractTenantId(profile)
  if (!tenantId) {
    throw new DossierFacileError('DossierFacile response did not include a tenant identifier.', 'invalid_profile', 502)
  }

  const sharingData = extractSharingData(profile)
  const name = extractTenantName(profile, user)
  const now = new Date()

  const [tenant] = await db
    .insert(dossierFacileTenants)
    .values({
      userId,
      tenantId,
      name,
      status: sharingData.status,
      url: sharingData.url,
      pdfUrl: sharingData.pdfUrl,
      lastSyncedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: dossierFacileTenants.tenantId,
      set: {
        name,
        status: sharingData.status,
        url: sharingData.url,
        pdfUrl: sharingData.pdfUrl,
        lastSyncedAt: now,
        updatedAt: now,
      },
    })
    .returning()

  return tenant!
}

export async function syncTenantFromCode(userId: string, code: string, user: { firstname: string; lastname: string; email: string }) {
  validateConfig()
  const accessToken = await exchangeCodeForToken(code)
  const profile = await getUserDossier(accessToken)
  return syncTenantFromProfile(userId, profile, user)
}

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const data = await response.json()
    return typeof data === 'object' && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
