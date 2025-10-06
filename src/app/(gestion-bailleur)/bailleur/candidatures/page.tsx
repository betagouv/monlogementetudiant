import Badge from '@codegouvfr/react-dsfr/Badge'
import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { Avatar } from '@codegouvfr/react-dsfr/picto'
import dayjs from 'dayjs'
import { CandidaturesFilters } from '~/app/(gestion-bailleur)/bailleur/candidatures/filters'

export default async function CandidaturesPage() {
  const candidatures = Array.from({ length: 15 }, (_, index) => ({
    id: index + 1,
    nom: `Pédieux`,
    prenom: `Kévin`,
    email: `candidat${index + 1}@example.com`,
    residence: `Résidence ${['Pietra', 'Ariane', 'Voltaire', 'Molière'][index % 4]}`,
    dateDepot: new Date(),
    statut: ['En attente', 'Accepté', 'Refusé'][index % 3],
    typeLogement: ['Studio', 'T1', 'T2'][index % 3],
  }))
  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={<>Gestion des candidatures</>}
        segments={[{ label: 'Tableau de bord', linkProps: { href: '/bailleur/tableau-de-bord' } }]}
        className="fr-mt-0 fr-pt-2w"
        classes={{ root: 'fr-mb-0' }}
      />

      <div className="fr-flex fr-align-items-center fr-flex-gap-4v">
        <Avatar width={72} height={72} />
        <h1 className="fr-mb-0">Gestion des candidatures</h1>
      </div>
      <hr className="fr-mt-2w fr-mb-0" />
      <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-mb-4w">
        <span className="fr-h4 fr-mb-0">{candidatures.length} candidatures</span>
        <CandidaturesFilters />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {candidatures.map((candidature, index) => (
          <div key={index} className="fr-flex fr-direction-column fr-background-default--grey fr-p-2w fr-border">
            <Badge severity="new" noIcon>
              A MODÉRER
            </Badge>
            <span className="fr-mb-2w fr-text-mention--grey fr-text--sm">
              Postée le {dayjs(candidature.dateDepot).format('DD MMMM YYYY')}
            </span>
            <span className="fr-h5 fr-text-title--blue-france fr-mb-0">
              {candidature.prenom} {candidature.nom}
            </span>
            <span className="fr-text-mention--grey fr-text--sm ri-building-line fr-mb-0">Résidence Petra</span>
            <span className="fr-text-mention--grey fr-text--sm ri-money-euro-circle-line fr-mb-0">Boursier</span>
            <div className="fr-flex fr-justify-content-end fr-text-title--blue-france">
              <span className="ri-arrow-right-line fr-text--sm fr-mb-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
