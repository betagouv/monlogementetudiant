import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

/** @type {import('next').NextConfig} */
const nextConfig = {
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
  async rewrites() {
    return [
      {
        source: '/preparer-sa-vie-etudiante',
        destination: 'https://mle-wordpress.osc-secnum-fr1.scalingo.io/preparer-sa-vie-etudiante/',
      },
      {
        source: '/preparer-sa-vie-etudiante/:path*',
        destination: 'https://mle-wordpress.osc-secnum-fr1.scalingo.io/preparer-sa-vie-etudiante/:path*/',
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
