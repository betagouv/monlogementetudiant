import Badge from '@codegouvfr/react-dsfr/Badge'
import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { DataVisualization } from '@codegouvfr/react-dsfr/picto'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { ResidenceChart } from '~/app/(gestion-bailleur)/bailleur/tableau-de-bord/chart'
import { auth } from '~/auth'
import avatarCecilia from '~/images/avatar-cecilia.svg'
import { getMyAccommodations } from '~/server-only/bailleur/get-my-accommodations'

export default async function TableauDeBordPage() {
  const calendlyUrl = z.string().parse(process.env.NEXT_PUBLIC_CALENDLY_URL)
  const t = await getTranslations('bailleur')
  const session = await auth()

  if (!session) {
    return notFound()
  }
  const accommodations = await getMyAccommodations({})

  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={<>{t('dashboard.breadcrumb.title', { name: session.user.name })}</>}
        segments={[]}
        className="fr-mt-0 fr-pt-2w"
        classes={{ root: 'fr-mb-0' }}
      />
      <div className="fr-flex fr-align-items-center fr-flex-gap-4v fr-mb-4w">
        <DataVisualization width={62} height={66} />
        <h1 className="fr-mb-0">{t('dashboard.welcome.title', { firstname: session.user.firstname })}</h1>
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div
          className="fr-col-6 fr-flex fr-direction-column fr-justify-content-space-between fr-align-items-center"
          style={{ background: 'white' }}
        >
          <div
            className="fr-flex fr-direction-column fr-align-items-center fr-justify-content-center fr-p-8w"
            style={{
              borderLeft: '4px solid #3B7FF6',
              minHeight: '398px',
            }}
          >
            <span className="fr-text--center fr-text--xl fr-mb-0">{t('dashboard.testimonial.quote')}</span>
            <div className="fr-flex fr-flex-gap-4v fr-mt-6w">
              <Image src={avatarCecilia.src} alt={t('dashboard.testimonial.altText')} priority quality={100} width={56} height={56} />
              <div>
                <p className="fr-text--bold fr-mb-0">{t('dashboard.testimonial.author')}</p>
                <p className="fr-mb-0">{t('dashboard.testimonial.organization')}</p>
              </div>
            </div>
          </div>
          <div className="fr-flex fr-justify-content-space-between fr-width-full" style={{ borderTop: '1px solid #dddddd' }}>
            <div
              className="fr-col-6 fr-p-2w fr-flex fr-direction-column fr-flex-gap-4v fr-align-items-center fr-justify-content-center"
              style={{ borderRight: '1px solid #dddddd' }}
            >
              <div className="fr-flex fr-flex-gap-4v">
                <span className="ri-question-line" />
                <div className="fr-flex fr-direction-column fr-flex-gap-2v">
                  <span className="fr-text--bold">{t('dashboard.helpSection.faq.title')}</span>
                  <Link className="fr-link" href="/bailleur/centre-d-aide">
                    {t('dashboard.helpSection.faq.link')}
                  </Link>
                </div>
              </div>
            </div>
            <div className="fr-col-6 fr-p-2w fr-flex fr-direction-column fr-flex-gap-4v fr-align-items-center fr-justify-content-center">
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span className="ri-discuss-line" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="fr-text--bold">{t('dashboard.helpSection.contact.title')}</span>
                  <Link className="fr-link" target="_blank" href={calendlyUrl}>
                    {t('dashboard.helpSection.contact.link')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          className="fr-col-6"
          style={{ background: 'white', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
          <span className="fr-h3 fr-text--bold">{t('dashboard.priorityActions.title')}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={{ border: '1px solid #dddddd', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="fr-h6 fr-text-title--blue-france fr-mb-0">{t('dashboard.priorityActions.actions.charter.title')}</span>
                <Badge severity="info" noIcon>
                  {t('dashboard.priorityActions.actions.charter.badge')}
                </Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="fr-text--xs fr-mb-0">{t('dashboard.priorityActions.actions.charter.status')}</span>
                <span className="ri-arrow-right-line" />
              </div>
            </div>
            <div style={{ border: '1px solid #dddddd', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="fr-h6 fr-text-title--blue-france fr-mb-0">
                  {t('dashboard.priorityActions.actions.availability.title')}
                </span>
                <Badge severity="success" noIcon>
                  {t('dashboard.priorityActions.actions.availability.badge')}
                </Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="fr-text--xs fr-mb-0">{t('dashboard.priorityActions.actions.availability.status')}</span>
                <span className="ri-arrow-right-line" />
              </div>
            </div>
            <div style={{ border: '1px solid #dddddd', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="fr-h6 fr-text-title--blue-france fr-mb-0">
                  {t('dashboard.priorityActions.actions.applications.title')}
                </span>
                <Badge severity="new" style={{ backgroundColor: '#fee7fc', color: '#6e445a' }} noIcon>
                  {t('dashboard.priorityActions.actions.applications.badge')}
                </Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
      <div style={{ background: 'white', marginTop: '2rem', paddingBottom: '2rem', padding: '2rem' }}>
        <span className="fr-h5">{t('dashboard.statistics.title')}</span>
        <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {accommodations.results.features.map((res, index) => (
            <div key={index} className="fr-border fr-px-4w fr-py-2w fr-flex fr-justify-content-space-between fr-direction-column">
              <span className="fr-h6">{res.properties.name}</span>
              <div style={{ height: '200px' }}>
                <ResidenceChart />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
