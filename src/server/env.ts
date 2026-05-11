import { z } from 'zod'

const isProd = process.env.NEXT_PUBLIC_APP_ENV === 'production' || process.env.NEXT_PUBLIC_APP_ENV === 'staging'

const optionalUrl = z.preprocess((v) => (v === '' ? undefined : v), z.url().optional())
const requiredInProdUrl = isProd ? z.url() : optionalUrl
const requiredInProd = isProd ? z.string().min(1) : z.string().optional()

const envSchema = z.object({
  // Core
  BASE_URL: z.url(),
  AUTH_SECRET: z.string().min(1),
  DATABASE_URL: z.string().min(1),

  // Brevo (email)
  BREVO_API_KEY: z.string().min(1, 'BREVO_API_KEY is required'),
  BREVO_API_URL: z.url().default('https://api.brevo.com/v3/smtp/email'),
  // accepts only entire positive numbers for the brevo templates.
  BREVO_TEMPLATE_MAGIC_LINK: z.coerce.number().int().positive(),
  BREVO_TEMPLATE_VALIDATION: z.coerce.number().int().positive(),
  BREVO_TEMPLATE_RESET_PASSWORD: z.coerce.number().int().positive(),
  BREVO_TEMPLATE_OWNER_WELCOME: z.coerce.number().int().positive(),

  // S3
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default('gra'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_SUFFIX_DIR: z.string().default(''),

  // Geocoding
  GEOCODING_API_URL: z.url().default('https://data.geopf.fr/geocodage/search'),

  // DossierFacile OAuth
  DOSSIERFACILE_CLIENT_ID: requiredInProd,
  DOSSIERFACILE_CLIENT_SECRET: requiredInProd,
  DOSSIERFACILE_AUTHORIZE_URL: requiredInProdUrl,
  DOSSIERFACILE_TOKEN_URL: requiredInProdUrl,
  DOSSIERFACILE_TENANT_PROFILE_URL: requiredInProdUrl,
  DOSSIERFACILE_REDIRECT_URI: requiredInProdUrl,
  DOSSIERFACILE_SCOPE: requiredInProd,
  DOSSIERFACILE_WEBHOOK_API_KEY: requiredInProd,

  // Public vars (validated server-side for CI)
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NEXT_PUBLIC_MATOMO_URL: requiredInProdUrl,
  NEXT_PUBLIC_MATOMO_SITE_ID: requiredInProd,
  NEXT_PUBLIC_TALLY_URL: requiredInProd,
  NEXT_PUBLIC_CALENDLY_URL: requiredInProdUrl,
  NEXT_PUBLIC_GITBOOK_URL: optionalUrl,
  NEXT_PUBLIC_DOSSIERFACILE_LOCATAIRE_URL: requiredInProdUrl,

  // CLI : Matomo
  MATOMO_URL: requiredInProdUrl,
  MATOMO_TOKEN: requiredInProd,
  MATOMO_ID_SITE: requiredInProd,

  // CLI : Scalingo backup
  SCALINGO_API_TOKEN: requiredInProd,
  SCALINGO_APP: requiredInProd,
  SCALINGO_DB_ADDON_ID: requiredInProd,
  SCALINGO_REGION: z.string().default('osc-secnum-fr1'),

  // CLI : FacHabitat SFTP
  FAC_HABITAT_SFTP_HOST: requiredInProd,
  FAC_HABITAT_SFTP_USERNAME: requiredInProd,
  FAC_HABITAT_SFTP_PORT: z.coerce.number().default(22),
  FAC_HABITAT_SFTP_PASSWORD: requiredInProd,
  FAC_HABITAT_SFTP_REMOTE_PATH: requiredInProd,

  // CLI : iBail/ARPEJ
  IBAIL_API_HOST: requiredInProdUrl,
  IBAIL_API_AUTH_KEY: requiredInProd,
  IBAIL_API_AUTH_SECRET: requiredInProd,
})

export const env = envSchema.parse(process.env)
