import { fr } from '@codegouvfr/react-dsfr'
import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import { TooltipHoverOnly } from '~/components/tooltip-hover-only'
import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'
import styles from './accommodation-residence.module.css'

type AccommodationResidenceProps = {
  accommodation: TAccomodationDetails
}

export const AccommodationResidence = async ({ accommodation }: AccommodationResidenceProps) => {
  const t = await getTranslations('accomodation')

  const accommodationsTiles = [
    {
      type: 'T1',
      min: accommodation.price_min_t1,
      max: accommodation.price_max_t1,
      enabled: !!accommodation.nb_t1 && accommodation.price_min_t1,
      title: t('studio', { type: 'T1' }),
      tooltip: t('tooltip.t1'),
    },
    {
      type: 'T1bis',
      min: accommodation.price_min_t1_bis,
      max: accommodation.price_max_t1_bis,
      enabled: !!accommodation.nb_t1_bis && accommodation.price_min_t1_bis,
      title: t('studio', { type: 'T1bis' }),
      tooltip: t('tooltip.t1bis'),
    },
    {
      type: 'T2',
      min: accommodation.price_min_t2,
      max: accommodation.price_max_t2,
      enabled: !!accommodation.nb_t2 && accommodation.price_min_t2,
      title: t('studio', { type: 'T2' }),
      tooltip: t('tooltip.t2'),
    },
    {
      type: 'T3',
      min: accommodation.price_min_t3,
      max: accommodation.price_max_t3,
      enabled: !!accommodation.nb_t3 && accommodation.price_min_t3,
      title: t('appartement', { type: 'T3' }),
      tooltip: t('tooltip.t3'),
    },
    {
      type: 'T4',
      min: accommodation.price_min_t4,
      max: accommodation.price_max_t4,
      enabled: !!accommodation.nb_t4 && accommodation.price_min_t4,
      title: t('appartement', { type: 'T4' }),
      tooltip: t('tooltip.t4'),
    },
    {
      type: 'T5',
      min: accommodation.price_min_t5,
      max: accommodation.price_max_t5,
      enabled: !!accommodation.nb_t5 && accommodation.price_min_t5,
      title: t('appartement', { type: 'T5' }),
      tooltip: t('tooltip.t5'),
    },
    {
      type: 'T6',
      min: accommodation.price_min_t6,
      max: accommodation.price_max_t6,
      enabled: !!accommodation.nb_t6 && accommodation.price_min_t6,
      title: t('appartement', { type: 'T6' }),
      tooltip: t('tooltip.t6'),
    },
    {
      type: 'T7+',
      min: accommodation.price_min_t7_more,
      max: accommodation.price_max_t7_more,
      enabled: !!accommodation.nb_t7_more && accommodation.price_min_t7_more,
      title: t('appartement', { type: 'T7+' }),
      tooltip: t('tooltip.t7'),
    },
  ]

  const hasAccommodations = accommodationsTiles.some((tile) => tile.enabled)

  if (!hasAccommodations) {
    return (
      <div className={styles.section}>
        <h4>{t('availableAccommodations')}</h4>
        <Alert
          severity="warning"
          title="Informations à venir"
          description="Le bailleur n'a pas encore partagé les informations au sujet des logements de la résidence."
        />
      </div>
    )
  }
  const enabledAccommodationTiles = accommodationsTiles.filter((tile) => tile.enabled)

  return (
    <div className={styles.section}>
      <div className={styles.sectionContent}>
        <h4 className={fr.cx('fr-mb-0')}>{t('availableAccommodations')}</h4>
        <div className={styles.accommodationsContainer}>
          <div>
            <div className={styles.mainContainer}>
              {enabledAccommodationTiles.map((accommodation, idx) => (
                <div
                  className={clsx(
                    idx % 2 === 0 && idx !== enabledAccommodationTiles.length - 1 && styles.borderRightGrid,
                    styles.studioContainer,
                  )}
                  key={accommodation.type}
                >
                  <div className="fr-flex fr-flex-gap-2v">
                    <span className="ri-user-line fr-text--bold">{accommodation.title}</span>
                    <TooltipHoverOnly title={accommodation.tooltip} />
                  </div>

                  <div className={styles.pricesTiles}>
                    <span
                      style={{
                        backgroundColor: fr.colors.options.yellowTournesol._950_100.default,
                        borderRadius: '4px',
                        color: fr.colors.options.yellowTournesol.sun407moon922.default,
                        padding: '0 0.5rem',
                      }}
                      className="fr-text--bold"
                    >
                      {accommodation.min && accommodation.max && accommodation.min !== accommodation.max
                        ? `DE ${accommodation.min} À ${accommodation.max} €`
                        : `${accommodation.min} €`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.simulatorContainer}>
          <p className="fr-mb-0">
            <span className="ri-information-line fr-mr-1v" aria-hidden />
            <span className="fr-text--bold">{t('simulator')}</span>
            <p className="fr-mb-0">{t('simulatorDescription')}</p>
          </p>
          <Button
            size="small"
            iconId="fr-icon-money-euro-circle-fill"
            iconPosition="left"
            linkProps={{ href: '/simuler-mes-aides-au-logement' }}
            priority="tertiary"
          >
            {t('simulatorButton')}
          </Button>
        </div>
      </div>
    </div>
  )
}
