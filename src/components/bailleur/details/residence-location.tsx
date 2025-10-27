'use client'

import { fr } from '@codegouvfr/react-dsfr'
import Input from '@codegouvfr/react-dsfr/Input'
import AccommodationMap from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-map'
import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'

export const ResidenceLocation = ({ accommodation }: { accommodation: TAccomodationDetails }) => {
  const { address, city, geom } = accommodation
  const { coordinates } = geom
  const [longitude, latitude] = coordinates
  const { postal_code: postalCode } = accommodation
  return (
    <div className="fr-flex fr-justify-content-space-between fr-align-items-center">
      <div className="fr-col-6 fr-height-full fr-flex fr-direction-column fr-px-6w">
        <h3>Localisation</h3>
        <Input nativeInputProps={{ value: `${address} ${postalCode} ${city}` }} label="Adresse" className="fr-mb-0" />
      </div>
      <div style={{ width: '50%' }} className={fr.cx('fr-hidden', 'fr-unhidden-sm')}>
        <AccommodationMap latitude={latitude} longitude={longitude} />
      </div>
    </div>
  )
}
