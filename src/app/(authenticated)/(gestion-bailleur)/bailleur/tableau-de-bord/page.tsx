import Badge from '@codegouvfr/react-dsfr/Badge'
import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { DataVisualization } from '@codegouvfr/react-dsfr/picto'
import clsx from 'clsx'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { CalendlyLink } from '~/components/bailleur/calendly-link'
import avatarCecilia from '~/images/avatar-cecilia.svg'
import avatarYasmine from '~/images/avatar-yasmine.svg'
import { env } from '~/server/env'
import { buildHref } from '~/utils/preserve-query-params'
import { DashboardTabs } from './dashboard-tabs'
import { getBailleurDashboardPageContext } from './get-bailleur-dashboard-page-context'
import styles from './tableau-de-bord.module.css'

type TableauDeBordPageProps = {
  searchParams: Promise<{ page?: string; ownerId?: string }>
}

export default async function TableauDeBordPage({ searchParams }: TableauDeBordPageProps) {
  const calendlyUrl = z.string().parse(env.NEXT_PUBLIC_CALENDLY_URL)
  const awaitedSearchParams = await searchParams
  const t = await getTranslations('bailleur')
  const { session, accommodations } = await getBailleurDashboardPageContext(awaitedSearchParams)

  if (!session || !session.user) {
    return notFound()
  }

  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={<>{t('dashboard.breadcrumb.title', { name: session.user.name ?? '' })}</>}
        segments={[]}
        className="fr-mt-0 fr-pt-2w"
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />
      <div className="fr-flex fr-align-items-center fr-flex-gap-4v fr-my-4w fr-mt-md-0 fr-mb-md-4w">
        <DataVisualization width={62} height={66} />
        <h1 className="fr-mb-0">{t('dashboard.welcome.title', { firstname: session.user.firstname })}</h1>
      </div>
      <div className="fr-flex fr-direction-column fr-direction-md-row fr-flex-gap-4v">
        <div
          className={clsx(
            'fr-col-md-6 fr-flex fr-direction-column fr-justify-content-space-between fr-align-items-center',
            styles.testimonialContainer,
          )}
        >
          <div
            className={clsx(
              'fr-flex fr-direction-column fr-align-items-center fr-justify-content-center fr-p-4w fr-p-md-6w',
              styles.testimonialContent,
            )}
          >
            <span className="fr-text--center fr-text--xl fr-mb-0">{t('dashboard.testimonial.quote')}</span>
            <div className="fr-flex fr-align-items-center fr-direction-md-row fr-direction-column fr-flex-gap-4v fr-mt-6w fr-position-relative">
              <Image src={avatarCecilia.src} alt={t('dashboard.testimonial.altText')} priority quality={100} width={56} height={56} />
              <Image
                className={styles.avatarYasmine}
                src={avatarYasmine.src}
                alt="Logo Yasmine"
                priority
                quality={100}
                width={56}
                height={56}
              />
              <div>
                <p className="fr-text--bold fr-mb-0">{t('dashboard.testimonial.author')}</p>
                <p className="fr-mb-0">{t('dashboard.testimonial.organization')}</p>
              </div>
            </div>
          </div>
          <div
            className={clsx(
              'fr-flex fr-direction-md-row fr-direction-column fr-justify-content-space-between fr-width-full',
              styles.testimonialDivider,
            )}
          >
            <div
              className={clsx(
                styles.ctaBorder,
                'fr-col-md-6 fr-p-2w fr-flex fr-direction-column fr-flex-gap-4v fr-align-items-center fr-justify-content-center',
              )}
            >
              <div className="fr-flex fr-flex-gap-4v">
                <span className="fr-hidden fr-unhidden-md ri-question-line" />
                <div className="fr-flex fr-direction-column fr-flex-gap-2v">
                  <span className="fr-text--bold">{t('dashboard.helpSection.faq.title')}</span>
                  <Link className="fr-link" href={buildHref('/bailleur/centre-d-aide', awaitedSearchParams)}>
                    {t('dashboard.helpSection.faq.link')}
                  </Link>
                </div>
              </div>
            </div>
            <div className="fr-col-md-6 fr-p-2w fr-flex fr-direction-column fr-flex-gap-4v fr-align-items-center fr-justify-content-center">
              <div className={styles.helpSectionItem}>
                <span className="fr-hidden fr-unhidden-md ri-discuss-line" />
                <div className="fr-flex fr-direction-column fr-flex-gap-2v">
                  <span className="fr-text--bold">{t('dashboard.helpSection.contact.title')}</span>
                  <CalendlyLink className="fr-link" href={calendlyUrl}>
                    {t('dashboard.helpSection.contact.link')}
                  </CalendlyLink>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={clsx('fr-col-md-6', styles.priorityActionsContainer)}>
          <div>
            <span className="fr-h3 fr-text--bold">{t('dashboard.priorityActions.title')}</span>
            <div className={styles.actionsGrid}>
              <div className={styles.actionCard}>
                <div className={styles.actionHeader}>
                  <Link className="fr-link fr-link--no-underline" href={buildHref('/bailleur/residences', awaitedSearchParams)}>
                    <span className="fr-h6 fr-text-title--blue-france fr-mb-0">
                      {t('dashboard.priorityActions.actions.availability.title')}
                    </span>
                  </Link>
                  <Badge severity="success" className="fr-hidden fr-unhidden-md" noIcon>
                    {t('dashboard.priorityActions.actions.availability.badge')}
                  </Badge>
                </div>
                <div className={styles.actionFooter}>
                  <Link className="fr-link fr-link--no-underline" href={buildHref('/bailleur/residences', awaitedSearchParams)}>
                    <span className="ri-arrow-right-line" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.tabsWrapper}>
        <DashboardTabs accommodations={accommodations} page={Number(awaitedSearchParams.page) || 1} ownerId={awaitedSearchParams.ownerId} />
      </div>
    </div>
  )
}
