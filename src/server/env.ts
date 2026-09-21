import { z } from 'zod'

const isProd = process.env.NEXT_PUBLIC_APP_ENV === 'production' || process.env.NEXT_PUBLIC_APP_ENV === 'staging'
const isProdOnly = process.env.NEXT_PUBLIC_APP_ENV === 'production'

const optionalUrl = z.preprocess((v) => (v === '' ? undefined : v), z.url().optional())
const requiredInProdUrl = isProd ? z.url() : optionalUrl
const requiredInProd = isProd ? z.string().min(1) : z.string().optional()
/** Requis en production seulement — staging n'a pas l'équivalent (backups, par exemple). */
const requiredInProdOnly = isProdOnly ? z.string().min(1) : z.string().optional()

const envSchema = z.object({
  // Core
  BASE_URL: z.url(),
  AUTH_SECRET: z.string().min(1),
  DATABASE_URL: z.string().min(1),

  // Nombre maximum de connexions ouvertes par process (voir `src/server/db/index.ts`). Laisser vide
  // pour la valeur par défaut, qui dépend du type de process : le plafond de la base est partagé
  // entre tous les containers, tous les one-off et toutes les sessions psql.
  DATABASE_POOL_MAX: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().positive().optional()),

  // Alerting des crons : destinataires du mail envoyé quand un job planifié échoue.
  // Liste séparée par des virgules. Vide (ou absente) = aucun envoi, on se contente d'un
  // log — c'est l'interrupteur de la fonctionnalité, il n'y a pas de garde sur l'APP_ENV.
  CRON_FAILURE_EMAILS: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((email) => email.trim())
            .filter(Boolean)
        : [],
    )
    .pipe(z.array(z.email({ message: 'CRON_FAILURE_EMAILS doit contenir des adresses email séparées par des virgules' }))),

  // Brevo (email)
  BREVO_API_KEY: z.string().min(1, 'BREVO_API_KEY is required'),
  BREVO_API_URL: z.url().default('https://api.brevo.com/v3/smtp/email'),
  BREVO_CONTACTS_API_URL: z.url(),
  // accepts only entire positive numbers for the brevo templates.
  BREVO_TEMPLATE_MAGIC_LINK: z.coerce.number().int().positive(),
  BREVO_TEMPLATE_VALIDATION: z.coerce.number().int().positive(),
  BREVO_TEMPLATE_RESET_PASSWORD: z.coerce.number().int().positive(),
  BREVO_TEMPLATE_OWNER_WELCOME: z.coerce.number().int().positive(),
  BREVO_TEMPLATE_ADMIN_RESET_PASSWORD: z.coerce.number().int().positive(),
  BREVO_TEMPLATE_STUDENT_ALERT: z.coerce.number().int().positive(),
  BREVO_TEMPLATE_ALERT_CREATION: z.coerce.number().int().positive(),
  BREVO_TEMPLATE_ALERT_EXPIRY_REMINDER: z.coerce.number().int().positive(),
  BREVO_TEMPLATE_ALERT_DEACTIVATION: z.coerce.number().int().positive(),
  BREVO_TEMPLATE_CONTACT_CONFIRMATION: z.coerce.number().int().positive(),
  BREVO_TEMPLATE_APPLICATIONS_MANAGEMENT_GRANTED: z.coerce.number().int().positive(),
  BREVO_TEMPLATE_APPLICATIONS_SUSPENDED: z.coerce.number().int().positive(),

  // S3
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default('gra'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  /**
   * Bucket dédié aux backups de la base, distinct du bucket applicatif : un dump contient
   * toute la PII, il n'a rien à faire dans le bucket qui sert les médias en `public-read`.
   * Mêmes identifiants et même endpoint que `S3_BUCKET` (même compte OVH).
   *
   * Production seulement : on ne sauvegarde pas la base de staging.
   */
  S3_BACKUP_BUCKET: requiredInProdOnly,

  // Taille du cache d'images en mémoire de chaque container, en Mo. Lu directement par
  // cache-handler.mjs, qui tourne hors du graphe de modules de l'app : déclaré ici pour
  // rester documenté et validé au démarrage, pas pour y être importé.
  IMAGE_CACHE_MEMORY_MB: z.coerce.number().int().positive().default(128),

  // Coupe l'étage S3 du cache d'images : seul le cache mémoire du process reste actif.
  // Destiné au développement local, où les identifiants S3 pointent sur un bucket partagé
  // dont l'écriture du préfixe `image-cache/` n'est pas accordée. Lu directement par
  // cache-handler.mjs, comme IMAGE_CACHE_MEMORY_MB.
  IMAGE_CACHE_S3_DISABLED: z.enum(['0', '1', 'true', 'false']).default('0'),

  // Geocoding
  GEOCODING_API_URL: z.url().default('https://data.geopf.fr/geocodage/search'),

  // RAMSESE (référentiel des établissements du MEN — réseau RIE / passerelle Omogen)
  // NB : l'URL de base n'inclut PAS le préfixe /v3, ajouté dans le service.
  RAMSESE_API_URL: z.url().default('https://omogen-api-pr.phm.education.gouv.fr/ramsese-webservice'),
  RAMSESE_CODE_APPLICATION: z.string().length(2).default('00'),
  RAMSESE_API_KEY: requiredInProd,

  // DossierFacile OAuth
  DOSSIERFACILE_CLIENT_ID: requiredInProd,
  DOSSIERFACILE_CLIENT_SECRET: requiredInProd,
  DOSSIERFACILE_AUTHORIZE_URL: requiredInProdUrl,
  DOSSIERFACILE_TOKEN_URL: requiredInProdUrl,
  DOSSIERFACILE_TENANT_PROFILE_URL: requiredInProdUrl,
  DOSSIERFACILE_REDIRECT_URI: requiredInProdUrl,
  DOSSIERFACILE_SCOPE: requiredInProd,
  DOSSIERFACILE_WEBHOOK_API_KEY: requiredInProd,

  // Sentry : endpoint « security » qui reçoit les violations de la CSP Report-Only (src/proxy.ts).
  // URL complète, telle que donnée par Sentry (Project Settings > Security Headers). Optionnelle même en
  // production : sans elle la CSP Report-Only ne remonte rien, mais son absence ne doit pas bloquer le boot.
  SENTRY_CSP_REPORT_URI: optionalUrl,

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

  // CLI : API Scalingo — `import-backup` en local, et le cron `backup-db` en production.
  // Laissées optionnelles : les rendre requises ferait échouer le boot de l'app web, alors
  // que `ScalingoBackupService` lève déjà une erreur explicite qui déclenche le mail d'échec.
  SCALINGO_API_TOKEN: z.string().optional(),
  SCALINGO_APP: z.string().optional(),
  SCALINGO_REGION: z.string().default('osc-secnum-fr1'),

  // CLI : FacHabitat SFTP
  FAC_HABITAT_SFTP_HOST: requiredInProd,
  FAC_HABITAT_SFTP_USERNAME: requiredInProd,
  FAC_HABITAT_SFTP_PORT: z.coerce.number().default(22),
  FAC_HABITAT_SFTP_PASSWORD: requiredInProd,
  FAC_HABITAT_SFTP_REMOTE_PATH: z.string().optional(),

  // CLI : iBail/ARPEJ
  IBAIL_API_HOST: requiredInProdUrl,
  IBAIL_API_AUTH_KEY: requiredInProd,
  IBAIL_API_AUTH_SECRET: requiredInProd,

  // WordPress FAQ (Espace Gestionnaire)
  WP_FAQ_URL: z.url(),
  WP_FAQ_PAGE_ID: z.coerce.number().int().positive(),

  // API publique v1 (REST + OpenAPI/Scalar)
  API_V1_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  // Rate-limit par défaut appliqué à chaque clé d'API (surchargable par clé).
  API_V1_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  API_V1_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
})

export const env = envSchema.parse(process.env)
