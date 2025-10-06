import Badge from '@codegouvfr/react-dsfr/Badge'
import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import Companie from '@codegouvfr/react-dsfr/picto/Companie'
import clsx from 'clsx'
import { ResidenceFilters } from '~/app/(gestion-bailleur)/bailleur/residences/filters'
import { AccomodationCard } from '~/components/find-student-accomodation/card/find-student-accomodation-card'
import { getMyAccommodations } from '~/server-only/bailleur/get-my-accommodations'
import { sPluriel } from '~/utils/sPluriel'

export default async function ResidencesPage() {
  const accommodations = await getMyAccommodations({})
  const accommodationsList = accommodations.results.features.slice(0, 6)
  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={<>Gestion des résidences</>}
        segments={[{ label: 'Tableau de bord', linkProps: { href: '/bailleur/tableau-de-bord' } }]}
        className="fr-mt-0 fr-pt-2w"
        classes={{ root: 'fr-mb-0' }}
      />

      <div className="fr-flex fr-justify-content-space-between fr-align-items-center">
        <div className="fr-flex fr-align-items-center fr-flex-gap-4v">
          <Companie width={72} height={72} />
          <h1 className="fr-mb-0">Gestion des résidences</h1>
        </div>
        <Button iconId="ri-add-line">Nouvelle résidence</Button>
      </div>
      <hr className="fr-mt-2w fr-mb-0" />
      <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-mb-4w">
        <span className="fr-h4 fr-mb-0">{accommodationsList.length} résidences</span>
        <ResidenceFilters />
      </div>
      {accommodationsList.map((accommodation, index) => {
        const { nb_t1_available, nb_t1_bis_available, nb_t2_available, nb_t3_available, nb_t4_more_available } = accommodation.properties
        const availabilityValues = [nb_t1_available, nb_t1_bis_available, nb_t2_available, nb_t3_available, nb_t4_more_available]
        const nonNullValues = availabilityValues.filter((value): value is number => value !== null && value !== undefined)
        const nbAvailable = nonNullValues.length > 0 ? nonNullValues.reduce((sum, value) => sum + value, 0) : null
        const badgeAvailability =
          nbAvailable !== null && nbAvailable !== undefined ? (
            nbAvailable === 0 ? (
              <Badge severity="error" noIcon>
                <span className="fr-text--uppercase fr-mb-0">Disponibilité non communiquée</span>
              </Badge>
            ) : (
              <Badge severity="success" noIcon>
                {nbAvailable}&nbsp;
                <span className="fr-text--uppercase fr-mb-0">
                  DISPONIBILITÉ
                  {sPluriel(nbAvailable)}
                </span>
              </Badge>
            )
          ) : null

        return (
          <div
            className={clsx(
              'fr-border-top fr-border-left fr-border-right fr-flex',
              index === accommodations.results.features.length - 1 && 'fr-border-bottom',
            )}
            key={accommodation.id}
          >
            <div className="fr-p-4w">
              <AccomodationCard key={index} accomodation={accommodation} />
            </div>
            <div className="fr-width-full fr-p-4w fr-border-left" style={{ background: 'white' }}>
              {badgeAvailability}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '2rem' }}>
                <Input label="Studio T1" />
                <Input label="Studio T1" />
                <Input label="Studio T1" />
                <Input label="Studio T1" />
              </div>
              <div className="fr-flex fr-justify-content-end">
                <Button priority="secondary" iconId="ri-save-line">
                  Enregistrer
                </Button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
