'use client'

import Pagination from '@codegouvfr/react-dsfr/Pagination'
import { CandidaturesFilters } from '~/app/(authenticated)/(gestion-bailleur)/bailleur/candidatures/filters'
import { CandidatureCard } from '~/components/bailleur/candidatures/candidature-card'
import { useCandidatures } from '~/hooks/use-candidatures'

export const CandidaturesList = () => {
  const { data, isLoading, queryStates } = useCandidatures()

  if (isLoading) {
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-py-8w">
        <p>Chargement des candidatures...</p>
      </div>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="fr-flex fr-direction-column">
        <div className="fr-flex fr-justify-content-end">
          <CandidaturesFilters />
        </div>
        <div className="fr-flex fr-direction-column fr-align-items-center fr-py-8w">
          <h3>Aucune candidature</h3>
          <p>Vous n'avez pas encore reçu de candidature.</p>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(data.total / data.pageSize)

  return (
    <>
      <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-mb-4w">
        <span className="fr-h4 fr-mb-0">
          {data.total} candidature{data.total > 1 ? 's' : ''}
        </span>
        <CandidaturesFilters />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {data.items.map((candidature) => (
          <CandidatureCard key={candidature.id} candidature={candidature} />
        ))}
      </div>
      {totalPages > 1 && (
        <Pagination
          showFirstLast={false}
          count={totalPages}
          defaultPage={queryStates.page}
          className="fr-flex fr-justify-content-center fr-align-items-center fr-py-2w"
          getPageLinkProps={(page: number) => {
            const params = new URLSearchParams()
            if (queryStates.status) params.set('status', queryStates.status)
            if (queryStates.recherche) params.set('recherche', queryStates.recherche)
            if (queryStates.tri !== 'date_desc') params.set('tri', queryStates.tri)
            params.set('page', page.toString())
            return { href: `/bailleur/candidatures?${params.toString()}` }
          }}
        />
      )}
    </>
  )
}
