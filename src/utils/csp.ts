/**
 * CSP stricte basée sur un nonce par requête, envoyée en Report-Only à côté de la CSP de `next.config.mjs`.
 * Les violations remontent dans Sentry.
 *
 * `'strict-dynamic'` : les scripts chargés par un script déjà autorisé (bundles Next, Matomo, Sentry)
 * héritent de la confiance, sans liste d'hôtes à maintenir.
 */
export const buildStrictCsp = ({ nonce, isDev, reportUri }: { nonce: string; isDev: boolean; reportUri?: string }): string =>
  [
    ['script-src', `'nonce-${nonce}'`, "'strict-dynamic'", isDev && "'unsafe-eval'"].filter(Boolean).join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    reportUri && `report-uri ${reportUri}`,
  ]
    .filter(Boolean)
    .join('; ')

export const generateNonce = (): string => Buffer.from(crypto.randomUUID()).toString('base64')
