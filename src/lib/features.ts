export const FEATURES = {
  csvImport: false,
  // Interception des emails hors production (ADR 0003) : réglage admin masqué en production.
  emailInterception: process.env.NEXT_PUBLIC_APP_ENV !== 'production',
} as const
