'use client'

import { ResidenceCard } from '~/components/bailleur/residence-card'
import { useSignedDocumentUrl } from '~/hooks/use-signed-document-url'
import { TAccomodationCard } from '~/schemas/accommodations/accommodations'

export const CandidatureDetailAccommodation = ({
  accommodationCard,
  dfTenantId,
  hasPdfUrl,
}: {
  accommodationCard: TAccomodationCard
  dfTenantId: string
  hasPdfUrl: boolean
}) => {
  const { openDocument, isLoading } = useSignedDocumentUrl()

  return (
    <div>
      {accommodationCard && <ResidenceCard accomodation={accommodationCard} />}

      {hasPdfUrl && (
        <div className="fr-mt-4w">
          <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-3w">
            <span className="ri-file-list-3-line " aria-hidden="true" />
            <h2 className="fr-h4 fr-mb-0">Documents</h2>
          </div>
          <div className="fr-flex fr-direction-column">
            <button
              type="button"
              onClick={() => openDocument('tenantPdf', dfTenantId)}
              disabled={isLoading}
              className="fr-link fr-pb-2w fr-border-bottom"
            >
              {isLoading ? 'Ouverture...' : 'Dossier DossierFacile (PDF)'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
