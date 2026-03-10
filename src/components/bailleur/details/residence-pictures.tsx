'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { AccommodationImage } from '~/components/accommodation/accommodation-image'
import { AccommodationImages } from '~/components/accommodation/accommodation-images'
import { useUpdateResidenceDetails } from '~/hooks/use-update-residence-details'
import { useDeleteResidenceImage, useUploadResidenceImages, validateFiles } from '~/hooks/use-upload-residence-images'
import { TAccomodationMy } from '~/schemas/accommodations/accommodations'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const ResidencePictures = ({ accommodation }: { accommodation: TAccomodationMy }) => {
  const { control, watch, setValue } = useFormContext<TUpdateResidence>()
  const watchedImages = watch('images_urls')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const t = useTranslations('toast')

  const uploadMutation = useUploadResidenceImages(accommodation.properties.slug, accommodation.properties.name)
  const deleteMutation = useDeleteResidenceImage(accommodation.properties.slug, accommodation.properties.name)
  const updateMutation = useUpdateResidenceDetails(accommodation.properties.slug)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setSelectedFiles(files)
    setFileError(null)

    if (files.length > 0) {
      const validationError = validateFiles(files, t)
      if (validationError) {
        setFileError(validationError)
        return
      }

      uploadMutation.mutate(
        { files, currentImages: watchedImages || [] },
        {
          onSuccess: (data) => {
            setValue('images_urls', data.images_urls || [])
            setSelectedFiles([])
            if (fileInputRef.current) {
              fileInputRef.current.value = ''
            }
          },
          onError: () => {
            setSelectedFiles([])
            if (fileInputRef.current) {
              fileInputRef.current.value = ''
            }
          },
        },
      )
    }
  }

  const handleDeleteImage = (index: number, currentImages: string[]) => {
    const newImages = currentImages.filter((_, i) => i !== index)
    deleteMutation.mutate(newImages, {
      onSuccess: () => {
        setValue('images_urls', newImages)
      },
    })
  }

  const handleMoveImage = (index: number, direction: 'left' | 'right', currentImages: string[]) => {
    const newImages = [...currentImages]
    const newIndex = direction === 'left' ? index - 1 : index + 1
    ;[newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]]
    updateMutation.mutate(
      {
        images_urls: newImages,
      },
      {
        onSuccess: () => {
          setValue('images_urls', newImages)
        },
      },
    )
  }

  const getStatusText = () => {
    if (uploadMutation.isPending) {
      return 'Upload en cours...'
    }
    if (fileError) {
      return fileError
    }
    if (selectedFiles.length > 0) {
      return `${selectedFiles.length} fichier${selectedFiles.length > 1 ? 's' : ''} sélectionné${selectedFiles.length > 1 ? 's' : ''}`
    }
    return 'Aucun fichier sélectionné'
  }
  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <h3>Photos de la résidence</h3>
        <div className="fr-flex fr-direction-column fr-flex-gap-4v">
          Ajouter une photo
          <span className="fr-text-mention--grey fr-text--sm fr-mb-0">Taille maximale: 10 Mo. Format supporté: jpeg, png, webp</span>
          <div className="fr-flex fr-align-items-center fr-flex-gap-4v">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <Button priority="tertiary" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
              Parcourir...
            </Button>
            <span className={`fr-text--sm fr-mb-0 ${fileError ? 'fr-text--error' : 'fr-text-mention--grey'}`}>{getStatusText()}</span>
          </div>
        </div>
        <Controller
          name="images_urls"
          control={control}
          render={({ field }) => (
            <>
              {field.value && field.value.length > 0 && (
                <div className="fr-my-4w">
                  <div className="fr-flex fr-direction-row fr-flex-wrap fr-flex-gap-4v">
                    {field.value.map((imageUrl, index) => (
                      <div key={index} className="fr-flex fr-direction-column fr-align-items-center">
                        <AccommodationImage src={imageUrl} width={100} height={100} withModal={false} />
                        <div className="fr-flex fr-align-items-center">
                          <Button
                            priority="tertiary no outline"
                            iconId="ri-arrow-left-s-line"
                            size="small"
                            title="Déplacer vers la gauche"
                            disabled={index === 0 || updateMutation.isPending}
                            onClick={() => {
                              if (field.value) {
                                handleMoveImage(index, 'left', field.value)
                              }
                            }}
                          />
                          <Button
                            priority="tertiary no outline"
                            iconId="ri-delete-bin-line"
                            size="small"
                            title="Supprimer cette image"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (field.value) {
                                handleDeleteImage(index, field.value)
                              }
                            }}
                          />
                          <Button
                            priority="tertiary no outline"
                            iconId="ri-arrow-right-s-line"
                            size="small"
                            title="Déplacer vers la droite"
                            disabled={index === (field.value?.length ?? 0) - 1 || updateMutation.isPending}
                            onClick={() => {
                              if (field.value) {
                                handleMoveImage(index, 'right', field.value)
                              }
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        />
        {watchedImages && watchedImages.length > 0 && (
          <>
            <hr className="fr-mt-2w fr-mb-0" />
            <span>Aperçu</span>
            <div className="fr-mt-2w">
              <AccommodationImages images={watchedImages ?? []} withModal={false} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
