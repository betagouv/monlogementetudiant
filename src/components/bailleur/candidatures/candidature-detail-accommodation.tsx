'use client'

import { ResidenceCard } from '~/components/bailleur/residence-card'
import { useSignedDocumentUrl } from '~/hooks/use-signed-document-url'
import { TAccomodationCard } from '~/schemas/accommodations/accommodations'

const CATEGORY_LABELS: Record<string, string> = {
  IDENTIFICATION: 'Pièce d\u2019identité',
  RESIDENCY: 'Justificatif de domicile',
  PROFESSIONAL: 'Justificatif de situation professionnelle',
  FINANCIAL: 'Justificatif de ressources',
  TAX: 'Avis d\u2019imposition',
}

const SUB_CATEGORY_LABELS: Record<string, string> = {
  FRENCH_IDENTITY_CARD: 'Carte d\u2019identité',
  FRENCH_PASSPORT: 'Passeport',
  GUEST: 'Hébergé',
  TENANT: 'Locataire',
  OWNER: 'Propriétaire',
  OTHER_TAX: 'Autre document fiscal',
  MY_NAME: 'À mon nom',
  LESS_THAN_YEAR: 'Moins d\u2019un an',
  NO_INCOME: 'Sans revenu',
  STUDENT: 'Étudiant',
  CDI: 'CDI',
  CDD: 'CDD',
  ALTERNATION: 'Alternance',
  INTERNSHIP: 'Stage',
}

function documentLabel(category: string, subCategory: string | null): string {
  const catLabel = CATEGORY_LABELS[category] ?? category
  if (!subCategory) return catLabel
  const subLabel = SUB_CATEGORY_LABELS[subCategory]
  return subLabel ? `${catLabel} — ${subLabel}` : catLabel
}

type DocumentItem = { id: string; documentCategory: string; documentSubCategory: string | null }

export const CandidatureDetailAccommodation = ({
  accommodationCard,
  dfTenantId,
  hasPdfUrl,
  documents,
}: {
  accommodationCard: TAccomodationCard
  dfTenantId: string
  hasPdfUrl: boolean
  documents: { tenant: DocumentItem[]; guarantor: DocumentItem[] }
}) => {
  const { openDocument, isLoading } = useSignedDocumentUrl()

  const allDocs = [...documents.tenant, ...documents.guarantor]
  const hasDocuments = hasPdfUrl || allDocs.length > 0

  return (
    <div>
      {accommodationCard && <ResidenceCard accomodation={accommodationCard} />}

      {hasDocuments && (
        <div className="fr-mt-4w">
          <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-3w">
            <span className="ri-file-list-3-line " aria-hidden="true" />
            <h2 className="fr-h4 fr-mb-0">Documents</h2>
          </div>
          <div className="fr-flex fr-direction-column">
            {hasPdfUrl && (
              <button
                type="button"
                onClick={() => openDocument('tenantPdf', dfTenantId)}
                disabled={isLoading}
                className="fr-link fr-pb-2w fr-border-bottom"
              >
                Dossier DossierFacile (PDF)
              </button>
            )}
            {allDocs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => openDocument('document', doc.id)}
                disabled={isLoading}
                className="fr-link fr-pb-2w fr-pt-2w fr-border-bottom"
              >
                {documentLabel(doc.documentCategory, doc.documentSubCategory)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
