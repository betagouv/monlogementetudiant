import { withSentryConfig } from '@sentry/nextjs'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    ENABLE_PROXY_LOGS: process.env.ENABLE_PROXY_LOGS,
  },
  images: {
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
        source: '/widget/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/preparer-sa-vie-etudiante',
        destination: 'https://info.monlogementetudiant.beta.gouv.fr',
      },
      {
        source: '/preparer-sa-vie-etudiante/:path*',
        destination: 'https://info.monlogementetudiant.beta.gouv.fr/preparer-sa-vie-etudiante/:path*/',
      },
      {
        source: '/foire-aux-questions',
        destination: 'https://info.monlogementetudiant.beta.gouv.fr/foire-aux-questions/',
      },
      {
        source: '/app/:path*',
        destination: 'https://info.monlogementetudiant.beta.gouv.fr/app/:path*',
      },
      {
        source: '/wp-content/:path*',
        destination: 'https://info.monlogementetudiant.beta.gouv.fr/wp-content/:path*',
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
