import * as Sentry from '@sentry/nextjs'

let initialized = false

export function initCliSentry() {
  if (initialized) return
  Sentry.init({
    dsn: 'https://b92507bef9f540985af4fb41e2b4d42a@sentry.incubateur.net/269',
    tracesSampleRate: 0,
    environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',
    enabled: process.env.NEXT_PUBLIC_APP_ENV === 'production' || process.env.NEXT_PUBLIC_APP_ENV === 'staging',
  })
  initialized = true
}

/**
 * Capture une exception depuis une commande CLI puis vide le buffer Sentry : le process se
 * termine aussitôt après, donc sans `flush` l'événement serait perdu. N'émet jamais d'erreur
 * propre (on ne masque pas l'erreur d'origine à cause d'un souci de reporting).
 */
export async function captureCliException(error: unknown, context?: { tags?: Record<string, string> }): Promise<void> {
  try {
    initCliSentry()
    Sentry.captureException(error, context)
    await Sentry.flush(2000)
  } catch {
    // ignore
  }
}
