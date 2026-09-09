'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import clsx from 'clsx'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ResidenceChart } from '~/app/(authenticated)/(gestion-bailleur)/bailleur/tableau-de-bord/chart'
import { Pagination } from '~/components/ui/pagination'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'
import { calculateAvailability } from '~/utils/calculateAvailability'
import { buildHref } from '~/utils/preserve-query-params'
import styles from './tableau-de-bord.module.css'

interface DashboardResidencesProps {
  accommodations: TGetAccomodationsResponse
  page: number
  ownerId?: string
  /** Sans `manage_residences`, la fiche residence renvoie au tableau de bord : on n'affiche pas de lien. */
  canManageResidences: boolean
}

export function DashboardResidences({ accommodations, page, ownerId, canManageResidences }: DashboardResidencesProps) {
  const t = useTranslations('bailleur')

  return (
    <div className={styles.statisticsContainer}>
      <span className="fr-h5">{t('dashboard.statistics.title')}</span>
      <div className={styles.statisticsGrid}>
        {accommodations.results.map((res, index) => {
          const available = calculateAvailability(res.typologies)
          const total = res.nbTotalApartments || 0

          return (
            <div key={index} className={clsx('fr-px-3w fr-py-2w', styles.statisticsCard)}>
              <div>
                <div className="fr-flex fr-justify-content-space-between fr-align-items-center">
                  {canManageResidences ? (
                    <Link className="fr-link fr-link--no-underline" href={buildHref(`/bailleur/residences/${res.slug}`, { ownerId })}>
                      <span className="fr-text--bold fr-text-title--blue-france fr-text--lg">{res.name}</span>
                    </Link>
                  ) : (
                    <span className="fr-text--bold fr-text--lg">{res.name}</span>
                  )}
                  {!res.published && (
                    <Badge severity="warning" noIcon>
                      Dépubliée
                    </Badge>
                  )}
                </div>
                <p className="fr-text--xs fr-mb-0 fr-mt-1v fr-text-mention--grey">
                  {res.postalCode} {res.city}
                </p>
              </div>
              <ResidenceChart available={available} total={total} />
              {canManageResidences && (
                <div className="fr-flex fr-justify-content-end">
                  <Link className="fr-link fr-link--no-underline" href={buildHref(`/bailleur/residences/${res.slug}`, { ownerId })}>
                    <span className="ri-arrow-right-line fr-text-title--blue-france ri-xl" />
                  </Link>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {accommodations.count > accommodations.pageSize && (
        <Pagination
          showFirstLast={false}
          count={Math.ceil(accommodations.count / accommodations.pageSize)}
          defaultPage={page}
          className="fr-flex fr-justify-content-center fr-align-items-center fr-py-2w"
          getPageLinkProps={(p: number) => ({
            href: buildHref('/bailleur/tableau-de-bord', { ownerId }, { page: p }),
          })}
        />
      )}
    </div>
  )
}
