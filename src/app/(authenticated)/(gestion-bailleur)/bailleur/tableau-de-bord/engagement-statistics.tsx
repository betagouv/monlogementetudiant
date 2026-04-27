'use client'

import { Input } from '@codegouvfr/react-dsfr/Input'
import Pagination from '@codegouvfr/react-dsfr/Pagination'
import clsx from 'clsx'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import type { ReactNode } from 'react'
import { useOwnerStatistics } from '~/hooks/use-owner-statistics'
import { sPluriel } from '~/utils/sPluriel'
import styles from './engagement-statistics.module.css'

const PERIODS = ['7d', '30d', '90d'] as const

function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

function formatDelta(delta: number | null | undefined): { label: string; positive: boolean } | null {
  if (delta == null) return null
  if (delta === 0) return { label: '0%', positive: true }
  return { label: `${delta > 0 ? '+' : ''}${delta}%`, positive: delta >= 0 }
}

interface EngagementStatisticsProps {
  ownerId?: number
}

export function EngagementStatistics({ ownerId }: EngagementStatisticsProps) {
  const t = useTranslations('bailleur.dashboard.engagementStatistics')
  const [{ period, residencePage, residenceSearch, cityPage, citySearch }, setQueryStates] = useQueryStates({
    period: parseAsStringLiteral(PERIODS).withDefault('7d'),
    residencePage: parseAsInteger.withDefault(1),
    residenceSearch: parseAsString.withDefault(''),
    cityPage: parseAsInteger.withDefault(1),
    citySearch: parseAsString.withDefault(''),
  })

  const { overview, byAccommodation, byCity } = useOwnerStatistics({
    period,
    ownerId,
    residencePage,
    residenceSearch,
    cityPage,
    citySearch,
  })

  const kpis = overview.data
  const residenceItems = byAccommodation.data?.items ?? []
  const residenceTotal = byAccommodation.data?.total ?? 0
  const residencePageSize = byAccommodation.data?.pageSize ?? 1
  const residencePageCount = Math.max(1, Math.ceil(residenceTotal / residencePageSize))

  const cityItems = byCity.data?.items ?? []
  const cityTotal = byCity.data?.total ?? 0
  const cityPageSize = byCity.data?.pageSize ?? 1
  const cityPageCount = Math.max(1, Math.ceil(cityTotal / cityPageSize))

  return (
    <section className={styles.section}>
      <div className="fr-flex fr-direction-column fr-direction-md-row fr-justify-content-space-between fr-align-items-start fr-align-items-md-center fr-flex-gap-4v">
        <span className="fr-h5 fr-mb-0">{t('title')}</span>
        <div className={styles.presets} role="group" aria-label={t('periodLabel')}>
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              className={p === period ? styles.presetActive : styles.preset}
              onClick={() => setQueryStates({ period: p, residencePage: 1, cityPage: 1 })}
              aria-pressed={p === period}
            >
              {t(`period.${p}` as 'period.7d' | 'period.30d' | 'period.90d')}
            </button>
          ))}
        </div>
      </div>

      <div className={clsx(styles.kpiGrid, 'fr-mt-3w')}>
        <KpiCard
          icon="ri-notification-3-line"
          value={overview.isLoading ? null : (kpis?.nbAlerts ?? 0)}
          delta={formatDelta(kpis?.deltaAlerts)}
          description={
            <>
              <strong>{t('kpi.alertsBold')}</strong>
              {t('kpi.alertsSuffix')}
            </>
          }
        />
        <KpiCard
          icon="ri-heart-line"
          value={overview.isLoading ? null : (kpis?.nbFavorites ?? 0)}
          delta={formatDelta(kpis?.deltaFavorites)}
          description={
            <>
              <strong>{t('kpi.favoritesBold')}</strong>
              {t('kpi.favoritesSuffix')}
            </>
          }
          className={styles.kpiCardNoSideBorder}
        />
        <KpiCard
          icon="ri-external-link-line"
          value={overview.isLoading ? null : (kpis?.nbConsultOffer ?? 0)}
          delta={formatDelta(kpis?.deltaConsultOffer)}
          description={
            <>
              <strong>{t('kpi.consultOfferBold')}</strong>
              {t('kpi.consultOfferSuffix')}
            </>
          }
        />
      </div>

      <div className={clsx(styles.body, 'fr-mt-2w')}>
        <div className="fr-flex fr-direction-column fr-border fr-height-full">
          <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-flex-gap-4v fr-border-bottom fr-p-3w">
            <span className="fr-text--bold fr-text--lg fr-mb-0 fr-whitespace-nowrap">{t('cities.title')}</span>
            <Input
              label=""
              hideLabel
              nativeInputProps={{
                placeholder: t('cities.searchPlaceholder'),
                'aria-label': t('cities.searchLabel'),
                value: citySearch,
                onChange: (e) => setQueryStates({ citySearch: e.target.value, cityPage: 1 }),
              }}
              iconId="ri-search-line"
              className={clsx('fr-mb-0 fr-flex-shrink-0', styles.searchField)}
            />
          </div>
          {byCity.isLoading ? (
            <div className="fr-text--center fr-p-4w fr-text-mention--grey">{t('loading')}</div>
          ) : cityItems.length === 0 ? (
            <div className="fr-text--center fr-p-4w fr-text-mention--grey">{t('cities.empty')}</div>
          ) : (
            <>
              <ul className={clsx(styles.cityGrid, 'fr-flex-grow-1')}>
                {cityItems.map((c) => (
                  <li key={c.cityId} className={clsx(styles.cityItem, 'fr-flex fr-direction-column fr-flex-gap-1v fr-p-3w')}>
                    <span className="fr-text--bold">{c.name}</span>
                    <div className="fr-flex fr-flex-wrap fr-flex-gap-3v fr-text--xs fr-text-mention--grey fr-mb-0">
                      <span>
                        <span className={clsx(styles.metadataIcon, 'ri-search-line')} aria-hidden /> {formatNumber(c.nbSearches)}{' '}
                        {t('cities.search')}
                        {sPluriel(c.nbSearches)}
                      </span>
                      <span>
                        <span className={clsx(styles.metadataIcon, 'ri-notification-3-line')} aria-hidden /> {formatNumber(c.nbAlerts)}{' '}
                        {t('cities.alert')}
                        {sPluriel(c.nbAlerts)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              {cityPageCount > 1 && (
                <Pagination
                  showFirstLast={false}
                  count={cityPageCount}
                  defaultPage={cityPage}
                  className="fr-flex fr-justify-content-center fr-py-2w"
                  getPageLinkProps={(p: number) => ({
                    href: '#',
                    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
                      e.preventDefault()
                      setQueryStates({ cityPage: p })
                    },
                  })}
                />
              )}
            </>
          )}
        </div>

        <aside className="fr-flex fr-direction-column fr-flex-gap-2v fr-border fr-height-full">
          <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-flex-wrap fr-flex-gap-4v fr-border-bottom fr-p-3w">
            <span className="fr-text--bold fr-text--lg fr-mb-0">{t('residences.title')}</span>
            <Input
              label=""
              hideLabel
              nativeInputProps={{
                placeholder: t('residences.searchPlaceholder'),
                'aria-label': t('residences.searchLabel'),
                value: residenceSearch,
                onChange: (e) => setQueryStates({ residenceSearch: e.target.value, residencePage: 1 }),
              }}
              iconId="ri-search-line"
              className={clsx('fr-mb-0 fr-flex-shrink-0', styles.searchField)}
            />
          </div>
          {byAccommodation.isLoading ? (
            <div className="fr-text--center fr-p-4w fr-text-mention--grey">{t('loading')}</div>
          ) : residenceItems.length === 0 ? (
            <div className="fr-text--center fr-p-4w fr-text-mention--grey">{t('residences.empty')}</div>
          ) : (
            <>
              <ul className={clsx(styles.residenceList, 'fr-flex fr-direction-column fr-flex-grow-1')}>
                {residenceItems.map((row) => (
                  <li key={row.accommodationId} className={clsx(styles.residenceItem, 'fr-flex fr-direction-column fr-p-3w')}>
                    <Link className="fr-link fr-link--no-underline" href={`/bailleur/residences/${row.slug}`}>
                      <span className="fr-text--bold fr-text-title--blue-france">{row.name}</span>
                    </Link>
                    {!row.published && <span className="fr-text--xs fr-text-mention--grey"> {t('residences.unpublished')}</span>}
                    {(row.postalCode || row.cityName) && (
                      <p className="fr-text--xs fr-mb-0 fr-text-mention--grey">
                        {row.postalCode} {row.cityName}
                      </p>
                    )}
                    <div className="fr-flex fr-flex-wrap fr-flex-gap-3v fr-text--xs fr-text-mention--grey fr-mt-1w fr-mb-0">
                      <span>
                        <span className={clsx(styles.metadataIcon, 'ri-eye-line')} aria-hidden /> {formatNumber(row.nbViews)}{' '}
                        {t('residences.view')}
                        {sPluriel(row.nbViews)}
                      </span>
                      <span>
                        <span className={clsx(styles.metadataIcon, 'ri-heart-line')} aria-hidden /> {formatNumber(row.nbFavorites)}{' '}
                        {t('residences.favorite')}
                        {sPluriel(row.nbFavorites)}
                      </span>
                      <span>
                        <span className={clsx(styles.metadataIcon, 'ri-external-link-line')} aria-hidden />{' '}
                        {formatNumber(row.nbConsultOffer)} {t('residences.redirection')}
                        {sPluriel(row.nbConsultOffer)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              {residencePageCount > 1 && (
                <Pagination
                  showFirstLast={false}
                  count={residencePageCount}
                  defaultPage={residencePage}
                  className="fr-flex fr-justify-content-center fr-py-2w"
                  getPageLinkProps={(p: number) => ({
                    href: '#',
                    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
                      e.preventDefault()
                      setQueryStates({ residencePage: p })
                    },
                  })}
                />
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  )
}

function KpiCard({
  icon,
  value,
  delta,
  description,
  className,
}: {
  icon: string
  value: number | null
  delta: { label: string; positive: boolean } | null
  description: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('fr-flex fr-direction-column fr-flex-gap-4v fr-border fr-p-4w', className)}>
      <div className="fr-flex fr-justify-content-space-between fr-align-items-center">
        <span className={clsx(icon, 'fr-text-mention--grey', styles.kpiIcon)} aria-hidden />
        {delta && (
          <span className={clsx('fr-text--xs fr-text--medium fr-mb-0', delta.positive ? styles.kpiDeltaPositive : styles.kpiDeltaNegative)}>
            {delta.label}
          </span>
        )}
      </div>
      <div>
        <span className={styles.kpiValue}>{value === null ? '—' : formatNumber(value)}</span>
        <p className="fr-text--xs fr-mb-0">{description}</p>
      </div>
    </div>
  )
}
