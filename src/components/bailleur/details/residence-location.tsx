'use client'

import { fr } from '@codegouvfr/react-dsfr'
import Input from '@codegouvfr/react-dsfr/Input'
import AccommodationMap from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-map'
import { TAccomodationMy } from '~/schemas/accommodations/accommodations'

export const ResidenceLocation = ({ accommodation }: { accommodation: TAccomodationMy }) => {
  const { geometry } = accommodation
  const { address, city, postal_code: postalCode } = accommodation.properties
  const { coordinates } = geometry
  const [longitude, latitude] = coordinates
  return (
    <div className="fr-flex-sm fr-justify-content-md-space-between fr-align-items-md-center">
      <div className="fr-col-md-6 fr-height-full fr-flex fr-direction-column fr-p-2w fr-px-md-6w">
        <h3>Localisation</h3>
        <Input nativeInputProps={{ readOnly: true, value: `${address} ${postalCode} ${city}` }} label="Adresse" className="fr-mb-0" />
      </div>
      <div style={{ width: '50%' }} className={fr.cx('fr-hidden', 'fr-unhidden-sm')}>
        <AccommodationMap latitude={latitude} longitude={longitude} />
      </div>
    </div>
  )
}
