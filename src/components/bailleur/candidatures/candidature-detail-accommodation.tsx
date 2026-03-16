import { ResidenceCard } from '~/components/bailleur/residence-card'
import { TAccomodationCard } from '~/schemas/accommodations/accommodations'

export const CandidatureDetailAccommodation = ({
  accommodationCard,
  pdfUrl,
}: {
  accommodationCard: TAccomodationCard
  pdfUrl: string | null
}) => (
  <div>
    {accommodationCard && <ResidenceCard accomodation={accommodationCard} />}

    {pdfUrl && (
      <div className="fr-mt-4w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-3w">
          <span className="ri-file-list-3-line fr-text--lg" aria-hidden="true" />
          <h2 className="fr-h4 fr-mb-0">Documents</h2>
        </div>
        <div className="fr-flex fr-direction-column">
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="fr-link fr-pb-2w fr-border-bottom">
            Dossier DossierFacile (PDF)
          </a>
        </div>
      </div>
    )}
  </div>
)
