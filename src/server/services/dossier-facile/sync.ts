import { type TDossierFacileEnv, ZDossierFacileEnvSchema } from '~/schemas/dossier-facile/dossier-facile-env-var'
import { type TConnectedTenant, ZConnectedTenantSchema } from '~/schemas/dossier-facile/dossier-facile-profile'
import { db } from '~/server/db'
import { dossierFacileTenants } from '~/server/db/schema'

export class DossierFacileError extends Error {
  constructor(
    message: string,
    public errorType: string,
    public statusCode: number = 502,
  ) {
    super(message)
  }
}

export function validateDossierFacileConfig() {
  const result = ZDossierFacileEnvSchema.safeParse(process.env)
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Missing/invalid DossierFacile env vars: ${missing}`)
  }
  return result.data
}

export function buildDossierFacileAuthorizationUrl(state: string, loginHint?: string): string {
  const env = validateDossierFacileConfig()
  const params = new URLSearchParams({
    client_id: env.DOSSIERFACILE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: env.DOSSIERFACILE_REDIRECT_URI,
    scope: env.DOSSIERFACILE_SCOPE || 'openid',
    state,
  })
  if (loginHint) {
    params.set('login_hint', loginHint)
  }
  return `${env.DOSSIERFACILE_AUTHORIZE_URL}?${params.toString()}`
}

async function exchangeCodeForToken(env: TDossierFacileEnv, code: string): Promise<string> {
  let response: Response
  try {
    const credentials = btoa(`${env.DOSSIERFACILE_CLIENT_ID}:${env.DOSSIERFACILE_CLIENT_SECRET}`)
    response = await fetch(env.DOSSIERFACILE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.DOSSIERFACILE_REDIRECT_URI,
      }),
    })
  } catch {
    throw new DossierFacileError('Unable to reach DossierFacile token endpoint.', 'dossier_facile_token_endpoint_unreachable', 502)
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new DossierFacileError(
      payload.error_description || 'Unable to exchange DossierFacile authorization code.',
      'dossier_facile_token_exchange_failed',
      response.status === 400 || response.status === 401 ? 400 : 502,
    )
  }

  if (!payload.access_token) {
    throw new DossierFacileError('DossierFacile did not return an access token.', 'dossier_facile_invalid_token_response', 502)
  }

  return payload.access_token as string
}

async function getUserDossierFacile(env: TDossierFacileEnv, accessToken: string): Promise<TConnectedTenant> {
  let response: Response
  try {
    response = await fetch(env.DOSSIERFACILE_TENANT_PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new DossierFacileError('Unable to reach DossierFacile profile endpoint.', 'dossier_facile_profile_endpoint_unreachable', 502)
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new DossierFacileError(
      payload.error_description || 'Unable to fetch DossierFacile dossier.',
      'dossier_facile_profile_fetch_failed',
      502,
    )
  }

  const json = await response.json()
  const result = ZConnectedTenantSchema.safeParse(json)
  if (!result.success) {
    throw new DossierFacileError('Invalid profile response from DossierFacile.', 'dossier_facile_invalid_profile_response', 502)
  }

  return result.data
}

const STATUS_ALIASES: Record<string, string> = {
  validated: 'verified',
  verified_account: 'verified',
  deleted_account: 'access_revoked',
  declined: 'denied',
  denied_account: 'denied',
  archived: 'inactive',
  archived_account: 'inactive',
  merged_account: 'inactive',
  created_account: 'to_process',
  application_type_changed: 'incomplete',
  returned_account: 'incomplete',
}

const ALLOWED_STATUSES = new Set(['verified', 'denied', 'access_revoked', 'active', 'inactive', 'to_process', 'incomplete'])

export function normalizeStatus(raw: string | null | undefined): string | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase().replace(/-/g, '_').replace(/ /g, '_')
  const normalized = STATUS_ALIASES[key] ?? key
  return ALLOWED_STATUSES.has(normalized) ? normalized : null
}

export async function syncDossierFacileTenantFromProfile(
  userId: string,
  profile: TConnectedTenant,
  user: { firstname: string; lastname: string; email: string },
) {
  const { connectedTenantId, apartmentSharing } = profile
  const firstTenant = apartmentSharing.tenants[0]

  const name = firstTenant
    ? [firstTenant.firstName, firstTenant.lastName].filter(Boolean).join(' ') || `${user.firstname} ${user.lastname}`.trim() || user.email
    : `${user.firstname} ${user.lastname}`.trim() || user.email

  const status = normalizeStatus(apartmentSharing.status)
  const now = new Date()

  const rows = await db
    .insert(dossierFacileTenants)
    .values({
      userId,
      tenantId: String(connectedTenantId),
      name,
      status,
      url: apartmentSharing.dossierUrl ?? null,
      pdfUrl: apartmentSharing.dossierPdfUrl ?? null,
      lastSyncedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: dossierFacileTenants.tenantId,
      set: {
        name,
        status,
        url: apartmentSharing.dossierUrl ?? null,
        pdfUrl: apartmentSharing.dossierPdfUrl ?? null,
        lastSyncedAt: now,
        updatedAt: now,
      },
    })
    .returning()

  return rows[0]
}

export async function syncDossierFacileTenantFromCode(
  userId: string,
  code: string,
  user: { firstname: string; lastname: string; email: string },
) {
  const env = validateDossierFacileConfig()
  const accessToken = await exchangeCodeForToken(env, code)
  const profile = await getUserDossierFacile(env, accessToken)
  return syncDossierFacileTenantFromProfile(userId, profile, user)
}
