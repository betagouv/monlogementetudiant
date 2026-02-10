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

export default withNextIntl(nextConfig)

// export default withSentryConfig(withNextIntl(nextConfig), {
//   // For all available options, see:
//   // https://www.npmjs.com/package/@sentry/webpack-plugin#options

//   org: 'betagouv',

//   project: 'mle-front',
//   sentryUrl: 'https://sentry.incubateur.net/',

//   // Only print logs for uploading source maps in CI
//   silent: !process.env.CI,

//   // For all available options, see:
//   // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

//   // Upload a larger set of source maps for prettier stack traces (increases build time)
//   widenClientFileUpload: true,

//   // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
//   // This can increase your server load as well as your hosting bill.
//   // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
//   // side errors will fail.
//   // tunnelRoute: '/monitoring',

//   // Automatically tree-shake Sentry logger statements to reduce bundle size
//   disableLogger: true,
// })
