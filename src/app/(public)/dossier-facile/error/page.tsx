import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Erreur DossierFacile',
}

const errorMessages: Record<string, string> = {
  missing_params: 'Les paramètres de la requête sont manquants ou invalides.',
  missing_state: 'La session de connexion a expiré ou est introuvable. Veuillez réessayer.',
  invalid_state: 'La session de connexion est invalide. Veuillez réessayer.',
  expired_state: 'La session de connexion a expiré. Veuillez réessayer.',
  user_not_found: 'Votre compte utilisateur est introuvable.',
  sync_failed: 'La synchronisation avec DossierFacile a échoué. Veuillez réessayer ultérieurement.',
  doc_invalid_link: 'Le lien utilisé est incomplet ou malformé.',
  doc_not_found: 'Ce document n\u2019existe plus ou a été supprimé.',
  doc_unavailable: 'Le service DossierFacile n\u2019a pas pu fournir le document. Veuillez réessayer dans quelques instants.',
  doc_expired: 'Ce lien n\u2019est plus valide. Retournez sur la page de candidature et cliquez à nouveau sur le document.',
}

const DEFAULT_ERROR_MESSAGE = 'Une erreur est survenue lors de la connexion à DossierFacile. Veuillez réessayer.'

export default async function DossierFacileErrorPage({ searchParams }: { searchParams: Promise<{ error_type?: string }> }) {
  const { error_type } = await searchParams
  const description = (error_type && errorMessages[error_type]) || DEFAULT_ERROR_MESSAGE

  return (
    <div className="fr-container">
      <div className="fr-grid-row fr-grid-row--center fr-height-full fr-align-items-center">
        <div className="fr-col-12 fr-col-md-8 fr-col-lg-6">
          <div className="fr-mt-6w fr-mb-6w">
            <Alert severity="error" title="Erreur DossierFacile" description={description} />

            <div className="fr-mt-4w fr-btns-group">
              <Button
                linkProps={{
                  href: '/',
                }}
                priority="secondary"
              >
                Retour à l&#39;accueil
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
