import { notFound } from 'next/navigation'
import { FEATURES } from '~/lib/features'
import { EmailSettingsForm } from './email-settings-form'

export const metadata = {
  title: 'Interception des emails - Administration',
}

export default function EmailSettingsPage() {
  // Fonctionnalité indisponible en production (ADR 0003).
  if (!FEATURES.emailInterception) notFound()

  return (
    <>
      <h1 className="fr-h3 fr-mb-1w">Interception des emails</h1>
      <p className="fr-text--sm fr-mb-3w">
        Réglage disponible hors production uniquement (ADR 0003) — évite d’envoyer des emails aux vrais comptes depuis la recette.
      </p>
      <div className="fr-card fr-card--no-border fr-p-3w">
        <EmailSettingsForm />
      </div>
    </>
  )
}
