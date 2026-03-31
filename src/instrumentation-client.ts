import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: 'https://b92507bef9f540985af4fb41e2b4d42a@sentry.incubateur.net/269',
  tracesSampleRate: 0.1,
  enableLogs: false,
  environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',
  enabled: process.env.NEXT_PUBLIC_APP_ENV === 'production' || process.env.NEXT_PUBLIC_APP_ENV === 'staging',
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
