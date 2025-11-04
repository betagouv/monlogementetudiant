'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { Controller, useFormContext } from 'react-hook-form'
import { AccommodationImage } from '~/components/accommodation/accommodation-image'
import { AccommodationImages } from '~/components/accommodation/accommodation-images'
import { TAccomodationMy } from '~/schemas/accommodations/accommodations'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const ResidencePictures = ({ accommodation }: { accommodation: TAccomodationMy }) => {
  const { control, watch } = useFormContext<TUpdateResidence>()
  const { name } = accommodation.properties
  const watchedImages = watch('images_urls')
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
        <Controller
          name="images_urls"
          control={control}
          render={({ field }) => (
            <>
              {field.value && field.value.length > 0 && (
                <div className="fr-my-4w">
                  <div className="fr-flex fr-direction-row fr-justify-content-space-between fr-flex-wrap ">
                    {field.value.map((imageUrl, index) => (
                      <div key={index} className="fr-flex fr-direction-column fr-align-items-center">
                        <AccommodationImage src={imageUrl} width={100} height={100} withModal={false} />
                        <Button
                          priority="tertiary no outline"
                          iconId="ri-delete-bin-line"
                          size="small"
                          title="Supprimer cette image"
                          onClick={() => {
                            const newImages = field.value?.filter((_, i) => i !== index) || []
                            field.onChange(newImages)
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        />
        <hr className="fr-mt-2w fr-mb-0" />
        <span>Aperçu</span>
        <div className="fr-mt-2w">
          <AccommodationImages images={watchedImages ?? []} title={name} withModal={false} />
        </div>
      </div>
    </div>
  )
}
