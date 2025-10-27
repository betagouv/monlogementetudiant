'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { AccommodationImage } from '~/components/accommodation/accommodation-image'
import { AccommodationImages } from '~/components/accommodation/accommodation-images'
import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'

export const ResidencePictures = ({ accommodation }: { accommodation: TAccomodationDetails }) => {
  const { images_urls, name } = accommodation
  return (
    <div className="fr-border-bottom">
      <div className="fr-p-6w">
        <h3>Photos de la résidence</h3>
        <div className="fr-flex fr-direction-column fr-flex-gap-4v">
          Ajouter une photo
          <span className="fr-text-mention--grey fr-text--sm fr-mb-0">Taille maximale: 10 Mo. Format supporté: jpeg, png, webp</span>
          <div className="fr-flex fr-align-items-center fr-flex-gap-4v">
            <Button priority="tertiary">Parcourir...</Button>
            <span className="fr-text-mention--grey fr-text--sm fr-mb-0">Aucun fichier sélectionné</span>
          </div>
        </div>
        {accommodation.images_urls && accommodation.images_urls.length > 0 && (
          <div className="fr-my-4w">
            <div className="fr-flex fr-direction-row fr-justify-content-space-between fr-flex-wrap ">
              {accommodation.images_urls.map((imageUrl, index) => (
                <div key={index} className="fr-flex fr-direction-column fr-align-items-center">
                  <AccommodationImage src={imageUrl} width={100} height={100} withModal={false} />
                  <Button priority="tertiary no outline" iconId="ri-delete-bin-line" size="small" title="Supprimer cette image" />
                </div>
              ))}
            </div>
          </div>
        )}
        <hr className="fr-mt-2w fr-mb-0" />
        <span>Aperçu</span>
        <div className="fr-mt-2w">
          <AccommodationImages images={images_urls ?? []} title={name} withModal={false} />
        </div>
      </div>
    </div>
  )
}
