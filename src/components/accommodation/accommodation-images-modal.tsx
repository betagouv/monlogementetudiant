'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { tss } from 'tss-react'
import { accommodationPicturesModal, photoAlt } from './accommodation-images'

export const AccommodationImagesModal = ({ children, images, title }: { children: React.ReactNode; images: string[]; title: string }) => {
  const t = useTranslations('accomodation.images')
  const { classes } = useStyles()
  const [currentImage, setCurrentImage] = useState(0)
  return (
    <>
      {children}
      <accommodationPicturesModal.Component title={title} size="large">
        <div className={classes.container}>
          <div style={{ position: 'relative', width: '100%', height: '50vh' }}>
            <Image
              src={images[currentImage]}
              alt={photoAlt(t, currentImage + 1, images.length, title)}
              fill
              style={{ objectFit: 'contain' }}
            />
          </div>
          <p role="status" aria-live="polite" className="fr-sr-only">
            {t('photoStatus', { index: currentImage + 1, total: images.length })}
          </p>
        </div>
        {images.length > 1 && (
          <div className={classes.buttonsContainer}>
            <div className={clsx(classes.buttons, 'fr-mt-4w')}>
              <Button
                iconId="ri-arrow-left-line"
                priority="secondary"
                title={t('previousImage')}
                onClick={() => setCurrentImage(currentImage - 1)}
                disabled={currentImage === 0}
              />
              <Button
                iconId="ri-arrow-right-line"
                priority="secondary"
                title={t('nextImage')}
                onClick={() => setCurrentImage(currentImage + 1)}
                disabled={currentImage === images.length - 1}
              />
            </div>
          </div>
        )}
      </accommodationPicturesModal.Component>
    </>
  )
}

const useStyles = tss.create({
  buttonsContainer: {
    display: 'flex',
    borderTop: '1px solid var(--border-default-grey)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '1rem',
  },
  buttons: {
    display: 'flex',
    gap: '1rem',
  },
  container: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
})
