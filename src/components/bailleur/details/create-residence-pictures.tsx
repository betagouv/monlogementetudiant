'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { validateFiles } from '~/hooks/use-upload-residence-images'
import { TCreateResidence } from '~/schemas/accommodations/create-residence'

export const CreateResidencePictures = () => {
  const { setValue, watch } = useFormContext<TCreateResidence>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const selectedFiles = watch('images_files') || []

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setFileError(null)

    if (files.length > 0) {
      const validationError = validateFiles(files)
      if (validationError) {
        setFileError(validationError)
        return
      }
      setValue('images_files', [...selectedFiles, ...files])
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index)
    setValue('images_files', newFiles)
  }

  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <h3>Photos de la résidence</h3>
        <div className="fr-flex fr-direction-column fr-flex-gap-4v">
          Ajouter des photos
          <span className="fr-text-mention--grey fr-text--sm fr-mb-0">Taille maximale: 10 Mo. Format support&eacute;: jpeg, png, webp</span>
          <div className="fr-flex fr-align-items-center fr-flex-gap-4v">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <Button type="button" priority="tertiary" onClick={() => fileInputRef.current?.click()}>
              Parcourir...
            </Button>
            <span className={`fr-text--sm fr-mb-0 ${fileError ? 'fr-text--error' : 'fr-text-mention--grey'}`}>
              {fileError
                ? fileError
                : selectedFiles.length > 0
                  ? `${selectedFiles.length} fichier${selectedFiles.length > 1 ? 's' : ''} s\u00e9lectionn\u00e9${selectedFiles.length > 1 ? 's' : ''}`
                  : 'Aucun fichier s\u00e9lectionn\u00e9'}
            </span>
          </div>
        </div>

        {selectedFiles.length > 0 && (
          <div className="fr-my-4w">
            <div className="fr-flex fr-direction-row fr-flex-wrap fr-flex-gap-4v">
              {selectedFiles.map((file, index) => (
                <div key={index} className="fr-flex fr-direction-column fr-align-items-center">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    width={100}
                    height={100}
                    style={{ objectFit: 'cover', borderRadius: '4px' }}
                  />
                  <Button
                    type="button"
                    priority="tertiary no outline"
                    iconId="ri-delete-bin-line"
                    size="small"
                    title="Supprimer cette image"
                    onClick={() => handleRemoveFile(index)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
