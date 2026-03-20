import Badge from '@codegouvfr/react-dsfr/Badge'
import { APARTMENT_TYPE_LABELS, ApartmentType } from '~/enums/apartment-type'

export const CandidatureDetailDossier = ({ apartmentType }: { apartmentType: string }) => (
  <>
    <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-3w">
      <span className="ri-building-4-line fr-text--lg" aria-hidden="true" />
      <h2 className="fr-h4 fr-mb-0">Demande de logement</h2>
    </div>

    <Badge severity="info" noIcon className="fr-mb-2w">
      TYPE DE LOGEMENT
    </Badge>

    <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-1w">
      <span className="ri-group-line" aria-hidden="true" />
      <span>{APARTMENT_TYPE_LABELS[apartmentType as ApartmentType] ?? apartmentType}</span>
    </div>
    <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-3w">
      <span className="ri-wheelchair-line" aria-hidden="true" />
      <span className="fr-text-mention--grey">Non renseigné</span>
    </div>

    <hr className="fr-my-3w" />

    <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-3w">
      <span className="ri-user-search-line fr-text--lg" aria-hidden="true" />
      <h2 className="fr-h4 fr-mb-0">A propos du candidat</h2>
    </div>

    <Badge severity="info" noIcon className="fr-mb-2w">
      PROFIL
    </Badge>

    <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-2w">
      <span className="ri-calendar-event-line" aria-hidden="true" />
      <span className="fr-text-mention--grey">Non renseigné</span>
    </div>
    <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-4w">
      <span className="ri-school-line" aria-hidden="true" />
      <span className="fr-text-mention--grey">Non renseigné</span>
    </div>

    <Badge severity="info" noIcon className="fr-mb-2w">
      SITUATION
    </Badge>

    <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-2w">
      <span className="ri-money-euro-circle-line" aria-hidden="true" />
      <span className="fr-text-mention--grey">Non renseigné</span>
    </div>
    <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-2w">
      <span className="ri-home-heart-line" aria-hidden="true" />
      <span className="fr-text-mention--grey">Non renseigné</span>
    </div>
    <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-2w">
      <span className="ri-team-line" aria-hidden="true" />
      <span className="fr-text-mention--grey">Non renseigné</span>
    </div>
    <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
      <span className="ri-briefcase-line" aria-hidden="true" />
      <span className="fr-text-mention--grey">Non renseigné</span>
    </div>
  </>
)
