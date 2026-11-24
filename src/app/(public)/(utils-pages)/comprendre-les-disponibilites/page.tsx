import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb'
import clsx from 'clsx'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ReactNode } from 'react'
import { AvailabilityBadge } from '~/components/shared/availability-badge'
import { WaitingListBadge } from '~/components/shared/waiting-list-badge'
import { getCanonicalUrl } from '~/utils/canonical'
import styles from './page.module.css'

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations('metadata')
  return {
    title: t('availabilityStatuses.title'),
    description: t('availabilityStatuses.description'),
    alternates: { canonical: getCanonicalUrl('/comprendre-les-disponibilites') },
  }
}

export default async function ComprendreLesDisponibilites() {
  const [t, tCard, tAccommodation, breadcrumbT] = await Promise.all([
    getTranslations('availabilityStatuses'),
    getTranslations('findAccomodation.card'),
    getTranslations('accomodation'),
    getTranslations('breadcrumbs'),
  ])

  const badgeProps = {
    noAvailabilityText: tCard('noAvailability'),
    availabilityText: (count: number) => tCard('availabilityCount', { count }),
    unknownAvailabilityText: tCard('unknownAvailability'),
    as: 'span' as const,
    className: 'fr-badge--sm',
  }

  const statuses: { key: string; badge: ReactNode }[] = [
    { key: 'available', badge: <AvailabilityBadge nbAvailable={12} {...badgeProps} /> },
    { key: 'none', badge: <AvailabilityBadge nbAvailable={0} {...badgeProps} /> },
    { key: 'unknown', badge: <AvailabilityBadge nbAvailable={null} {...badgeProps} /> },
    {
      key: 'waitingList',
      badge: (
        <WaitingListBadge
          acceptWaitingList
          nbAvailable={0}
          waitingListText={tAccommodation('waitingList')}
          as="span"
          className="fr-badge--sm"
        />
      ),
    },
  ]

  return (
    <div className="fr-container fr-pb-6w">
      <Breadcrumb
        currentPageLabel={breadcrumbT('availabilityStatuses')}
        homeLinkProps={{ href: '/' }}
        segments={[]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>
      <ul className={clsx('fr-raw-list fr-mb-4w', styles.statuses)}>
        {statuses.map(({ key, badge }) => (
          <li key={key} className={styles.status}>
            <div className="fr-grid-row fr-grid-row--gutters">
              <div className="fr-col-12 fr-col-md-4">{badge}</div>
              <div className="fr-col-12 fr-col-md-8">
                <h2 className="fr-h6 fr-mb-1w">{t(`statuses.${key}.title`)}</h2>
                <p className="fr-text--sm fr-mb-0">{t(`statuses.${key}.description`)}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="fr-text--bold fr-mb-0">{t('reportError')}</p>
    </div>
  )
}
