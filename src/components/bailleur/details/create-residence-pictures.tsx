'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { AccommodationImage } from '~/components/accommodation/accommodation-image'
import { AccommodationImages } from '~/components/accommodation/accommodation-images'
import { validateFiles } from '~/hooks/use-upload-residence-images'
import { TCreateResidence } from '~/schemas/accommodations/create-residence'

export const CreateResidencePictures = () => {
  const { setValue, watch } = useFormContext<TCreateResidence>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const t = useTranslations('toast')
  const tPictures = useTranslations('bailleur.residences.details.pictures')
  const watchedFiles = watch('imagesFiles')
  const selectedFiles = useMemo(() => watchedFiles ?? [], [watchedFiles])

  const previewUrls = useMemo(() => selectedFiles.map((file) => URL.createObjectURL(file)), [selectedFiles])
  useEffect(() => () => previewUrls.forEach((url) => URL.revokeObjectURL(url)), [previewUrls])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setFileError(null)

    if (files.length > 0) {
      const validationError = validateFiles(files, t)
      if (validationError) {
        setFileError(validationError)
        return
      }
      setValue('imagesFiles', [...selectedFiles, ...files])
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveFile = (index: number) => {
    setValue(
      'imagesFiles',
      selectedFiles.filter((_, i) => i !== index),
    )
  }

  const handleMoveFile = (index: number, direction: 'left' | 'right') => {
    const newIndex = direction === 'left' ? index - 1 : index + 1
    const newFiles = [...selectedFiles]
    ;[newFiles[index], newFiles[newIndex]] = [newFiles[newIndex], newFiles[index]]
    setValue('imagesFiles', newFiles)
  }

  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <h3>{tPictures('title')}</h3>
        <div className="fr-flex fr-direction-column fr-flex-gap-4v">
          {tPictures('addPhotos')}
          <span className="fr-text-mention--grey fr-text--sm fr-mb-0">{tPictures('hint')}</span>
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
              {tPictures('browse')}
            </Button>
            <span className={`fr-text--sm fr-mb-0 ${fileError ? 'fr-text--error' : 'fr-text-mention--grey'}`}>
              {fileError
                ? fileError
                : selectedFiles.length > 0
                  ? tPictures('selectedFiles', { count: selectedFiles.length })
                  : tPictures('noFileSelected')}
            </span>
          </div>
        </div>

        {previewUrls.length > 0 && (
          <>
            <div className="fr-my-4w">
              <div className="fr-flex fr-direction-row fr-flex-wrap fr-flex-gap-4v">
                {previewUrls.map((url, index) => (
                  <div key={url} className="fr-flex fr-direction-column fr-align-items-center">
                    <AccommodationImage
                      src={url}
                      alt={tPictures('imageAlt', { index: index + 1, total: previewUrls.length })}
                      width={100}
                      height={100}
                      withModal={false}
                    />
                    <div className="fr-flex fr-align-items-center">
                      <Button
                        type="button"
                        priority="tertiary no outline"
                        iconId="ri-arrow-left-s-line"
                        size="small"
                        title={tPictures('moveLeft')}
                        disabled={index === 0}
                        onClick={() => handleMoveFile(index, 'left')}
                      />
                      <Button
                        type="button"
                        priority="tertiary no outline"
                        iconId="ri-delete-bin-line"
                        size="small"
                        title={tPictures('deleteImage')}
                        onClick={() => handleRemoveFile(index)}
                      />
                      <Button
                        type="button"
                        priority="tertiary no outline"
                        iconId="ri-arrow-right-s-line"
                        size="small"
                        title={tPictures('moveRight')}
                        disabled={index === previewUrls.length - 1}
                        onClick={() => handleMoveFile(index, 'right')}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <hr className="fr-mt-2w fr-mb-0" />
            <span>{tPictures('preview')}</span>
            <div className="fr-mt-2w">
              <AccommodationImages images={previewUrls} withModal={false} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
