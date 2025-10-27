import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { ResidenceAccommodationList } from '~/components/bailleur/details/residence-accommodation-list'
import { ResidenceEquipments } from '~/components/bailleur/details/residence-equipments'
import { ResidenceLocation } from '~/components/bailleur/details/residence-location'
import { ResidenceDetails } from '~/components/bailleur/details/residence-parametrage'
import { ResidencePictures } from '~/components/bailleur/details/residence-pictures'
import { ResidenceRedirection } from '~/components/bailleur/details/residence-redirection'
import { ResidenceSummary } from '~/components/bailleur/details/residence-summary'
import { getAccommodationById } from '~/server-only/get-accommodation-by-id'
import styles from './residence-details.module.css'

export default async function ResidenceDetailsPage({ params }: { params: { slug: string } }) {
  const accommodation = await getAccommodationById(params.slug)
  const { city } = accommodation
  const redirectUri = `/trouver-un-logement-etudiant/ville/${encodeURIComponent(city)}/${accommodation.slug}`
  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={<>{accommodation.name}</>}
        segments={[
          { label: 'Tableau de bord', linkProps: { href: '/bailleur/tableau-de-bord' } },
          { label: 'Gestion des résidences', linkProps: { href: '/bailleur/residences' } },
        ]}
        className="fr-mt-0 fr-pt-2w"
        classes={{ root: 'fr-mb-2w' }}
      />

      <div className="fr-flex fr-justify-content-space-between fr-align-items-center">
        <h1 className="fr-mb-0">{accommodation.name}</h1>
        <div className="fr-flex fr-flex-gap-4v">
          <Button iconId="ri-save-line">Enregistrer</Button>
          <Button priority="secondary" linkProps={{ href: redirectUri, target: '_blank' }}>
            Voir la fiche
          </Button>
        </div>
      </div>
      <div className="fr-flex fr-justify-content-space-between fr-py-4w fr-flex-gap-4v">
        <div className={clsx(styles.container, 'fr-col-8')}>
          <ResidenceDetails accommodation={accommodation} />
          <ResidencePictures accommodation={accommodation} />
          <ResidenceAccommodationList accommodation={accommodation} />
          <ResidenceEquipments accommodation={accommodation} />
          <ResidenceSummary accommodation={accommodation} />
          <ResidenceLocation accommodation={accommodation} />
        </div>
        <div className={clsx(styles.container, styles.stickyColumn, 'fr-width-full')}>
          <div className="fr-flex fr-justify-content-center fr-p-6w">
            {/* todo */}
            <span className="fr-mb-0 fr-text--xs">Dernière modification il y a 3 jours</span>
          </div>
          <ResidenceRedirection accommodation={accommodation} />
        </div>
      </div>
    </div>
  )
}
