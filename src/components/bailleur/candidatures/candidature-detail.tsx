'use client'

import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import Button from '@codegouvfr/react-dsfr/Button'
import { Tabs } from '@codegouvfr/react-dsfr/Tabs'
import { useQuery } from '@tanstack/react-query'
import { notFound } from 'next/navigation'
import { type ReactNode } from 'react'
import { CandidatureDetailAccommodation } from '~/components/bailleur/candidatures/candidature-detail-accommodation'
import { CandidatureDetailDossier } from '~/components/bailleur/candidatures/candidature-detail-dossier'
import { CandidatureDetailSuivi } from '~/components/bailleur/candidatures/candidature-detail-suivi'
import { TAccomodationCard } from '~/schemas/accommodations/accommodations'
import { useTRPC } from '~/server/trpc/client'

const TabLayout = ({
  children,
  pdfUrl,
  accommodation,
}: {
  pdfUrl: string | null
  accommodation: TAccomodationCard
  children: ReactNode
}) => (
  <div className="fr-grid-row fr-grid-row--gutters">
    <div className="fr-col-12 fr-col-md-7">{children}</div>
    <div className="fr-col-12 fr-col-md-5">
      <CandidatureDetailAccommodation accommodationCard={accommodation} pdfUrl={pdfUrl} />
    </div>
  </div>
)

interface CandidatureDetailProps {
  id: number
}

export const CandidatureDetail = ({ id }: CandidatureDetailProps) => {
  const trpc = useTRPC()
  const { data: candidature, isLoading } = useQuery(trpc.bailleur.getCandidature.queryOptions({ id }))

  if (isLoading) {
    return (
      <div className="fr-container fr-pb-12w">
        <p>Chargement...</p>
      </div>
    )
  }

  if (!candidature) return notFound()

  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={candidature.studentName ?? 'Candidat'}
        segments={[
          { label: 'Tableau de bord', linkProps: { href: '/bailleur/tableau-de-bord' } },
          { label: 'Gestions de candidatures', linkProps: { href: '/bailleur/candidatures' } },
        ]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />

      <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-mb-4w">
        <h1 className="fr-h2 fr-mb-0">Candidature de {candidature.studentName ?? 'Candidat'}</h1>
        {candidature.tenantUrl && (
          <Button
            priority="primary"
            iconId="ri-external-link-line"
            iconPosition="right"
            linkProps={{ href: candidature.tenantUrl, target: '_blank', rel: 'noopener noreferrer' }}
          >
            Consulter le DossierFacile
          </Button>
        )}
      </div>

      <hr className="fr-mt-0 fr-mb-0" />

      <Tabs
        tabs={[
          {
            label: 'Dossier',
            content: (
              <TabLayout
                accommodation={candidature.accommodation}
                pdfUrl={candidature.pdfUrl}
                children={<CandidatureDetailDossier apartmentType={candidature.apartmentType} />}
              />
            ),
          },
          {
            label: 'Suivi',
            content: (
              <TabLayout
                accommodation={candidature.accommodation}
                pdfUrl={candidature.pdfUrl}
                children={<CandidatureDetailSuivi status={candidature.status} />}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
