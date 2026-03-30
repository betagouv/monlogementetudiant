import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: 'https://2bfaae24d4d42e44a371fb625d421d3d@sentry.incubateur.net/275',
  tracesSampleRate: 0.1,
  enableLogs: false,
  environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',
  enabled: process.env.NEXT_PUBLIC_APP_ENV === 'production' || process.env.NEXT_PUBLIC_APP_ENV === 'staging',
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
