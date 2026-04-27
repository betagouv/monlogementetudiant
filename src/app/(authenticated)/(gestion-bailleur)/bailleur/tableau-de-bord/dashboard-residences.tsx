'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Pagination from '@codegouvfr/react-dsfr/Pagination'
import clsx from 'clsx'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ResidenceChart } from '~/app/(authenticated)/(gestion-bailleur)/bailleur/tableau-de-bord/chart'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'
import { calculateAvailability } from '~/utils/calculateAvailability'
import { buildHref } from '~/utils/preserve-query-params'
import styles from './tableau-de-bord.module.css'

interface DashboardResidencesProps {
  accommodations: TGetAccomodationsResponse
  page: number
  ownerId?: string
}

export function DashboardResidences({ accommodations, page, ownerId }: DashboardResidencesProps) {
  const t = useTranslations('bailleur')

  return (
    <div className={styles.statisticsContainer}>
      <span className="fr-h5">{t('dashboard.statistics.title')}</span>
      <div className={styles.statisticsGrid}>
        {accommodations.results.features.map((res, index) => {
          const {
            nb_t1_available,
            nb_t1_bis_available,
            nb_t2_available,
            nb_t3_available,
            nb_t4_available,
            nb_t5_available,
            nb_t6_available,
            nb_t7_more_available,
            nb_t1,
            nb_t1_bis,
            nb_t2,
            nb_t3,
            nb_t4,
            nb_t5,
            nb_t6,
            nb_t7_more,
          } = res.properties
          const calculatedAvailability = calculateAvailability(
            {
              nb_t1_available,
              nb_t1_bis_available,
              nb_t2_available,
              nb_t3_available,
              nb_t4_available,
              nb_t5_available,
              nb_t6_available,
              nb_t7_more_available,
            },
            { nb_t1, nb_t1_bis, nb_t2, nb_t3, nb_t4, nb_t5, nb_t6, nb_t7_more },
          )
          const available = calculatedAvailability
          const total = res.properties.nb_total_apartments || 0

          return (
            <div key={index} className={clsx('fr-px-3w fr-py-2w', styles.statisticsCard)}>
              <div>
                <div className="fr-flex fr-justify-content-space-between fr-align-items-center">
                  <Link
                    className="fr-link fr-link--no-underline"
                    href={buildHref(`/bailleur/residences/${res.properties.slug}`, { ownerId })}
                  >
                    <span className="fr-text--bold fr-text-title--blue-france fr-text--lg">{res.properties.name}</span>
                  </Link>
                  {!res.properties.published && (
                    <Badge severity="warning" noIcon>
                      Dépubliée
                    </Badge>
                  )}
                </div>
                <p className="fr-text--xs fr-mb-0 fr-mt-1v fr-text-mention--grey">
                  {res.properties.postal_code} {res.properties.city}
                </p>
              </div>
              <ResidenceChart available={available} total={total} />
              <div className="fr-flex fr-justify-content-end">
                <Link
                  className="fr-link fr-link--no-underline"
                  href={buildHref(`/bailleur/residences/${res.properties.slug}`, { ownerId })}
                >
                  <span className="ri-arrow-right-line fr-text-title--blue-france ri-xl" />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
      {accommodations.count > accommodations.page_size && (
        <Pagination
          showFirstLast={false}
          count={Math.ceil(accommodations.count / accommodations.page_size)}
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
