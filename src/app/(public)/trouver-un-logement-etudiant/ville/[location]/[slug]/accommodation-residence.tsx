import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { TooltipHoverOnly } from '~/components/tooltip-hover-only'
import { NewWindowHint } from '~/components/ui/new-window'
import { EResidenceType } from '~/enums/residence-type'
import { ETargetAudience } from '~/enums/target-audience'
import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'
import { isPerPersonTypology } from '~/utils/is-per-person-typology'
import { getSocialHousingApplicationLink } from '~/utils/social-housing-application-link'
import styles from './accommodation-residence.module.css'
import { FjtRsjaNotice } from './fjt-rsja-notice'

type AccommodationResidenceProps = {
  accommodation: TAccomodationDetails
}

export const AccommodationResidence = async ({ accommodation }: AccommodationResidenceProps) => {
  const t = await getTranslations('accomodation')
  const { socialHousingRequired } = accommodation
  const socialHousingApplicationLink = getSocialHousingApplicationLink(accommodation.departmentCode)

  const tileDefs = [
    { suffix: 't1', type: 'T1', title: t('studio', { type: 'T1' }), tooltip: t('tooltip.t1') },
    { suffix: 't1_bis', type: 'T1bis', title: t('studio', { type: 'T1bis' }), tooltip: t('tooltip.t1bis') },
    { suffix: 't2', type: 'T2', title: t('studio', { type: 'T2' }), tooltip: t('tooltip.t2') },
    { suffix: 't3', type: 'T3', title: t('appartement', { type: 'T3' }), tooltip: t('tooltip.t3') },
    { suffix: 't4', type: 'T4', title: t('appartement', { type: 'T4' }), tooltip: t('tooltip.t4') },
    { suffix: 't5', type: 'T5', title: t('appartement', { type: 'T5' }), tooltip: t('tooltip.t5') },
    { suffix: 't6', type: 'T6', title: t('appartement', { type: 'T6' }), tooltip: t('tooltip.t6') },
    { suffix: 't7_more', type: 'T7+', title: t('appartement', { type: 'T7+' }), tooltip: t('tooltip.t7') },
  ] as const
  const accommodationsTiles = tileDefs.map(({ suffix, type, title, tooltip }) => {
    const v = accommodation.typologies[suffix]
    return {
      type,
      title,
      tooltip,
      min: v?.priceMin ?? null,
      max: v?.priceMax ?? null,
      superficieMin: v?.superficieMin ?? null,
      superficieMax: v?.superficieMax ?? null,
      enabled: !!v?.nbTotal && !!v?.priceMin,
    }
  })

  const hasAccommodations = accommodationsTiles.some((tile) => tile.enabled)

  if (!hasAccommodations) {
    return (
      <div className={styles.section}>
        {accommodation.nbTotalApartments ? (
          <h3 className="fr-h4">{t('availableAccommodationsCount', { count: accommodation.nbTotalApartments })}</h3>
        ) : (
          <h3 className="fr-h4">{t('availableAccommodations')}</h3>
        )}{' '}
        <Alert
          severity="warning"
          title="Informations à venir"
          description="Le gestionnaire n'a pas encore partagé les informations au sujet des logements de la résidence."
        />
      </div>
    )
  }
  const enabledAccommodationTiles = accommodationsTiles.filter((tile) => tile.enabled)

  return (
    <div className={styles.section}>
      <div className={styles.sectionContent}>
        {accommodation.nbTotalApartments ? (
          <h3 className="fr-mb-0 fr-h4">{t('availableAccommodationsCount', { count: accommodation.nbTotalApartments })}</h3>
        ) : (
          <h3 className="fr-mb-0 fr-h4">{t('availableAccommodations')}</h3>
        )}

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
                    <TooltipHoverOnly id={`tooltip-residence-${accommodation.type}`} title={accommodation.tooltip} />
                  </div>

                  {accommodation.superficieMin && accommodation.superficieMax && (
                    <span className="fr-text--sm fr-mb-0">
                      {accommodation.superficieMin === accommodation.superficieMax
                        ? `${accommodation.superficieMin} m²`
                        : `Entre ${accommodation.superficieMin} et ${accommodation.superficieMax} m²`}
                    </span>
                  )}

                  <p className="fr-mb-0">
                    {accommodation.min && accommodation.max && accommodation.min !== accommodation.max
                      ? `De ${accommodation.min} à ${accommodation.max} €`
                      : `${accommodation.min} €`}{' '}
                    {isPerPersonTypology(accommodation.type) && `${t('perPerson')} `}
                    {t('charges')}
                  </p>
                </div>
              ))}
            </div>
            {accommodation.rentalChargesDetails && (
              <div className="fr-mt-3w fr-px-2w">
                <p className="fr-text--sm fr-mb-0 fr-text--bold">
                  <span className="ri-building-line" aria-hidden />
                  {t('rentalChargesDetails')}
                </p>
                <p className="fr-text--sm fr-mb-0 fr-text-mention--grey">{accommodation.rentalChargesDetails}</p>
              </div>
            )}
            {socialHousingRequired && (
              <div>
                <hr className="fr-mt-3w fr-mb-0" />
                <span className="ri-information-line fr-text--sm fr-mb-0">
                  {t.rich('socialHousingRequired', {
                    bold: (chunks) => <strong>{chunks}</strong>,
                  })}
                  &nbsp;
                </span>
                <Link
                  className="fr-link fr-link--icon-right fr-icon-arrow-right-line fr-text--sm fr-mt-1v"
                  href={socialHousingApplicationLink.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t('socialHousingRequiredLink')}
                  <NewWindowHint />
                </Link>
              </div>
            )}
          </div>
        </div>
        {!!accommodation.targetAudience &&
          [ETargetAudience.DIFFUS_MIXTE, ETargetAudience.DIFFUS_ETUDIANTS].includes(accommodation.targetAudience) && (
            <div className="fr-flex fr-direction-column fr-direction-md-row fr-align-items-md-center fr-flex-gap-2v fr-border fr-px-3w fr-py-2w">
              <span className={clsx('ri-community-line fr-hidden fr-unhidden-sm', styles.diffusIcon)} aria-hidden />
              <p className="fr-mb-0 fr-flex fr-direction-column">
                <span className="fr-text--bold">
                  {accommodation.targetAudience === ETargetAudience.DIFFUS_MIXTE
                    ? t('diffusMixteNoticeTitle')
                    : t('diffusEtudiantsNoticeTitle')}
                </span>
                {accommodation.targetAudience === ETargetAudience.DIFFUS_MIXTE && (
                  <span className="fr-mb-0">{t('diffusMixteNoticeDescription')}</span>
                )}
              </p>
            </div>
          )}
        {(accommodation.residenceType === EResidenceType.JEUNES_TRAVAILLEURS ||
          accommodation.residenceType === EResidenceType.SOCIALE_JEUNES_ACTIFS) && <FjtRsjaNotice />}
        <div className="fr-flex fr-direction-column fr-direction-md-row fr-justify-content-space-between fr-align-items-md-center fr-flex-gap-2v fr-border fr-px-3w fr-py-2w">
          <span className={clsx('ri-calculator-line fr-hidden fr-unhidden-sm', styles.simulatorIcon)} aria-hidden />
          <p className="fr-mb-0 fr-flex fr-direction-column">
            <span className="fr-text--bold">{t('simulator')}</span>
            <span className="fr-mb-0">{t('simulatorDescription')}</span>
          </p>
          <Button size="small" linkProps={{ href: '/simuler-mes-aides-au-logement' }} priority="secondary">
            {t('simulatorButton')}
          </Button>
        </div>
      </div>
    </div>
  )
}
