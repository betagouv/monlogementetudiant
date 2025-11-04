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
    <div className="fr-flex fr-justify-content-space-between fr-align-items-center">
      <div className="fr-col-6 fr-height-full fr-flex fr-direction-column fr-px-6w">
        <h3>Localisation</h3>
        <Input nativeInputProps={{ readOnly: true, value: `${address} ${postalCode} ${city}` }} label="Adresse" className="fr-mb-0" />
      </div>
      <div style={{ width: '50%' }} className={fr.cx('fr-hidden', 'fr-unhidden-sm')}>
        <AccommodationMap latitude={latitude} longitude={longitude} />
      </div>
    </div>
  )
}
