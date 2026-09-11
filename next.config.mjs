import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withSentryConfig } from '@sentry/nextjs'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const commonSecurityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
]

if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
  commonSecurityHeaders.push({ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' })
}

const isDev = process.env.NODE_ENV !== 'production'

// Origine du tracker Matomo : le script `matomo.js` et les requêtes de suivi en proviennent.
// `headers()` est évalué au build, la variable doit donc être présente à ce moment-là ; sinon
// la directive est simplement omise (Matomo n'est chargé qu'en production, cf. src/app/matomo.tsx).
const matomoOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_MATOMO_URL ? new URL(process.env.NEXT_PUBLIC_MATOMO_URL).origin : null
  } catch {
    return null
  }
})()

// Les pages éditoriales du WordPress `info.` sont relayées sous notre domaine (cf. src/utils/wp-proxy.ts) :
// leur HTML pointe vers des styles restés là-bas et vers les polices Marianne du bucket WordPress.
const wpOrigin = 'https://info.monlogementetudiant.beta.gouv.fr'
const ovhBuckets = 'https://*.s3.gra.io.cloud.ovh.net'

/** Le widget est embarquable par des tiers, le reste du site non : seul `frame-ancestors` varie. */
const buildCsp = (frameAncestors) =>
  [
    "default-src 'self'",
    // Next injecte ses scripts d'hydratation en inline sans nonce ; `unsafe-eval` n'est requis
    // que par le Fast Refresh du serveur de dev.
    ['script-src', "'self'", "'unsafe-inline'", isDev && "'unsafe-eval'", matomoOrigin].filter(Boolean).join(' '),
    // DSFR et emotion (tss-react) injectent des styles inline.
    `style-src 'self' 'unsafe-inline' ${wpOrigin}`,
    // `https:` faute de mieux : les favicons des sites bailleurs viennent d'origines arbitraires
    // (src/utils/get-favicon-url.ts). Couvre aussi les tuiles OSM, les marqueurs Leaflet (cdnjs,
    // raw.githubusercontent) et les photos S3 ; `blob:` sert aux aperçus avant upload.
    "img-src 'self' data: blob: https:",
    `font-src 'self' data: ${wpOrigin} ${ovhBuckets}`,
    // Autocomplétion d'adresse (data.geopf.fr), remontée d'erreurs Sentry, suivi Matomo.
    // `ws:` couvre le rechargement à chaud en dev.
    ['connect-src', "'self'", 'https://data.geopf.fr', 'https://sentry.incubateur.net', matomoOrigin, isDev && 'ws:']
      .filter(Boolean)
      .join(' '),
    // Vidéos de visite virtuelle hébergées ailleurs.
    "media-src 'self' https:",
    // Visites virtuelles : le code d'intégration est saisi par les bailleurs (YouTube, Matterport,
    // etc.). Les hôtes ne sont pas énumérables ; on impose au moins HTTPS.
    'frame-src https:',
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
  ].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    ENABLE_PROXY_LOGS: process.env.ENABLE_PROXY_LOGS,
  },
  // Cache incrémental : les images optimisées vont dans S3 au lieu du disque éphémère du
  // container, le reste garde le comportement par défaut de Next — cf. cache-handler.mjs.
  cacheHandler: path.join(rootDir, 'cache-handler.mjs'),
  images: {
    // Sans ce drapeau, `cacheHandler` ne couvre que le cache incrémental et les images
    // continuent d'atterrir dans `.next/cache/images`.
    customCacheHandler: true,
    qualities: [50, 75, 100],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'monlogementetudiant-s3-staging.s3.gra.io.cloud.ovh.net',
      },
      {
        protocol: 'https',
        hostname: 'monlogementetudiant-s3.s3.gra.io.cloud.ovh.net',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: commonSecurityHeaders,
      },
      {
        // Le widget est volontairement intégrable par des sites tiers ; les autres pages ne le sont pas.
        source: '/:path((?!widget(?:/|$)).*)',
        headers: [
          // Doublon volontaire de `frame-ancestors`, pour les navigateurs anciens.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: buildCsp("'self'") },
        ],
      },
      {
        source: '/widget/:path*',
        headers: [{ key: 'Content-Security-Policy', value: buildCsp('*') }],
      },
    ]
  },
  async redirects() {
    return [
      // Assets statiques WordPress (Bedrock : `app` = `wp-content` renommé). Ils sont déjà
      // référencés en absolu depuis `info.` ; on renvoie le navigateur en direct plutôt que
      // de relayer les octets à travers le container. Les pages éditoriales, elles, passent
      // par des Route Handlers cachés — cf. src/utils/wp-proxy.ts.
      {
        source: '/wp-content/:path*',
        destination: 'https://info.monlogementetudiant.beta.gouv.fr/wp-content/:path*',
        permanent: true,
      },
      {
        source: '/app/:path*',
        destination: 'https://info.monlogementetudiant.beta.gouv.fr/app/:path*',
        permanent: true,
      },
    ]
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.woff2$/,
      type: 'asset/resource',
    })
    return config
  },
}

export default withSentryConfig(withNextIntl(nextConfig), {
  org: 'betagouv',
  project: 'monlogementetudiant',
  sentryUrl: 'https://sentry.incubateur.net/',
  silent: !process.env.CI,
  widenClientFileUpload: true,
})
