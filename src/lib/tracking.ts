import { sendEvent } from '@socialgouv/matomo-next'

export type MatomoEventCategory =
  | 'Authentification'
  | 'Recherche'
  | 'Logement'
  | 'Favoris'
  | 'Alertes'
  | 'Widget'
  | 'Simulateur'
  | 'Espace Etudiant'
  | 'Espace Gestionnaire'
  | 'Navigation'
  | 'Engagement'
  | 'Dossier Facile'

type TrackEventParams = {
  category: MatomoEventCategory
  action: string
  name?: string
  value?: number
}

const isProduction = () => process.env.NEXT_PUBLIC_APP_ENV === 'production'

export function trackEvent({ category, action, name, value }: TrackEventParams) {
  if (!isProduction()) return

  if (name !== undefined && value !== undefined) {
    sendEvent({ category, action, name, value: value })
  } else if (name !== undefined) {
    sendEvent({ category, action, name })
  } else {
    sendEvent({ category, action })
  }
}
