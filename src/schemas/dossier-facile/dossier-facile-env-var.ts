import { z } from 'zod'

export const ZDossierFacileEnvSchema = z.object({
  DOSSIERFACILE_CLIENT_ID: z.string().min(1),
  DOSSIERFACILE_CLIENT_SECRET: z.string().min(1),
  DOSSIERFACILE_AUTHORIZE_URL: z.url(),
  DOSSIERFACILE_TOKEN_URL: z.url(),
  DOSSIERFACILE_TENANT_PROFILE_URL: z.url(),
  DOSSIERFACILE_REDIRECT_URI: z.url(),
  DOSSIERFACILE_SCOPE: z.string(),
})

export type TDossierFacileEnv = z.infer<typeof ZDossierFacileEnvSchema>
