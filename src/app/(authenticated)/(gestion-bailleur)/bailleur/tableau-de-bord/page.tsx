import Badge from '@codegouvfr/react-dsfr/Badge'
import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { DataVisualization } from '@codegouvfr/react-dsfr/picto'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { ResidenceChart } from '~/app/(authenticated)/(gestion-bailleur)/bailleur/tableau-de-bord/chart'
import { auth } from '~/auth'
import avatarCecilia from '~/images/avatar-cecilia.svg'
import avatarYasmine from '~/images/avatar-yasmine.svg'
import { getMyAccommodations } from '~/server-only/bailleur/get-my-accommodations'
import styles from './tableau-de-bord.module.css'

export default async function TableauDeBordPage() {
  const calendlyUrl = z.string().parse(process.env.NEXT_PUBLIC_CALENDLY_URL)
  const t = await getTranslations('bailleur')
  const session = await auth()

  if (!session) {
    return notFound()
  }
  const accommodations = await getMyAccommodations()

  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={<>{t('dashboard.breadcrumb.title', { name: session.user.name })}</>}
        segments={[]}
        className="fr-mt-0 fr-pt-2w"
        classes={{ root: 'fr-mb-0' }}
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
              'fr-flex fr-direction-column fr-align-items-center fr-justify-content-center fr-p-4w fr-p-md-8w',
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
                  <Link className="fr-link" href="/bailleur/centre-d-aide">
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
                  <Link className="fr-link" target="_blank" href={calendlyUrl}>
                    {t('dashboard.helpSection.contact.link')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={clsx('fr-col-md-6', styles.priorityActionsContainer)}>
          <span className="fr-h3 fr-text--bold">{t('dashboard.priorityActions.title')}</span>
          <div className={styles.actionsGrid}>
            <div className={styles.actionCard}>
              <div className={styles.actionHeader}>
                <span className="fr-h6 fr-text-title--blue-france fr-mb-0">{t('dashboard.priorityActions.actions.charter.title')}</span>
                <Badge severity="info" className="fr-hidden fr-unhidden-md" noIcon>
                  {t('dashboard.priorityActions.actions.charter.badge')}
                </Badge>
              </div>
              <div className={styles.actionFooter}>
                <span className="fr-text--xs fr-mb-0">{t('dashboard.priorityActions.actions.charter.status')}</span>
                <span className="ri-arrow-right-line" />
              </div>
            </div>
            <div className={styles.actionCard}>
              <div className={styles.actionHeader}>
                <span className="fr-h6 fr-text-title--blue-france fr-mb-0">
                  {t('dashboard.priorityActions.actions.availability.title')}
                </span>
                <Badge severity="success" className="fr-hidden fr-unhidden-md" noIcon>
                  {t('dashboard.priorityActions.actions.availability.badge')}
                </Badge>
              </div>
              <div className={styles.actionFooter}>
                <span className="fr-text--xs fr-mb-0">{t('dashboard.priorityActions.actions.availability.status')}</span>
                <span className="ri-arrow-right-line" />
              </div>
            </div>
            <div className={styles.actionCard}>
              <div className={styles.actionHeader}>
                <span className="fr-h6 fr-text-title--blue-france fr-mb-0">
                  {t('dashboard.priorityActions.actions.applications.title')}
                </span>
                <Badge severity="new" className={clsx('fr-hidden fr-unhidden-md', styles.customBadge)} noIcon>
                  {t('dashboard.priorityActions.actions.applications.badge')}
                </Badge>
              </div>
              <div className={styles.actionFooter}>
                <span className="fr-text--xs fr-mb-0">{t('dashboard.priorityActions.actions.applications.status')}</span>
                <span className="ri-arrow-right-line" />
              </div>
            </div>
          </div>

          <div className="fr-flex fr-justify-content-center fr-mt-2w">
            <Link className="fr-link fr-link--no-underline fr-text--sm fr-mb-0" href="/bailleur/centre-d-aide">
              {t('dashboard.priorityActions.viewAll')}
            </Link>
          </div>
        </div>
      </div>
      <div className={styles.statisticsContainer}>
        <span className="fr-h5">{t('dashboard.statistics.title')}</span>
        <div className={styles.statisticsGrid}>
          {accommodations.results.features.map((res, index) => {
            const { nb_t1_available, nb_t1_bis_available, nb_t2_available, nb_t3_available, nb_t4_more_available } = res.properties
            const availabilityValues = [nb_t1_available, nb_t1_bis_available, nb_t2_available, nb_t3_available, nb_t4_more_available]
            const nonNullValues = availabilityValues.filter((value): value is number => value !== null && value !== undefined)
            const available = nonNullValues.length > 0 ? nonNullValues.reduce((sum, value) => sum + value, 0) : 0
            const total = res.properties.nb_total_apartments || 0
            if (total === 0) return null

            return (
              <div key={index} className="fr-border fr-px-4w fr-py-2w fr-flex fr-justify-content-space-between fr-direction-column">
                <span className="fr-h6">{res.properties.name}</span>
                <div className={styles.statisticsChart}>
                  <ResidenceChart available={available} total={total} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
