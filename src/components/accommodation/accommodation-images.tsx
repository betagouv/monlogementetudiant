import Button from '@codegouvfr/react-dsfr/Button'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { AccommodationImage } from '~/components/accommodation/accommodation-image'
import { AccommodationImagesModal } from '~/components/accommodation/accommodation-images-modal'
import styles from './accommodation-images.module.css'

interface AccommodationImagesProps {
  images: string[]
  title?: string
  withModal?: boolean
}

export const accommodationPicturesModal = createModal({
  id: 'accommodation-images-modal',
  isOpenedByDefault: false,
})

interface ImageGridProps {
  images: string[]
  imageWidth: number
  imageHeight: number
  totalImages: number
  withModal: boolean
  title?: string
  /** Rang de la première vignette de la grille dans la galerie complète (la principale est la 1re). */
  offset: number
}

type TAccommodationImagesTranslator = ReturnType<typeof useTranslations<'accomodation.images'>>

export function photoAlt(t: TAccommodationImagesTranslator, index: number, total: number, title?: string): string {
  return title ? t('photoAltResidence', { index, total, title }) : t('photoAlt', { index, total })
}

function ImageGrid({ images, imageWidth, imageHeight, totalImages, withModal, title, offset }: ImageGridProps) {
  const t = useTranslations('accomodation.images')
  return (
    <div className={clsx('fr-hidden fr-unhidden-sm', withModal && styles.cursor, styles.gridContainer)} data-images={totalImages}>
      <div className={styles.imageGrid}>
        {images.map((image, index) => (
          <AccommodationImage
            key={index}
            src={image}
            alt={photoAlt(t, offset + index, totalImages, title)}
            openModalLabel={t('enlargePhoto', { index: offset + index, total: totalImages })}
            width={imageWidth}
            height={imageHeight}
            withModal={withModal}
          />
        ))}
      </div>
    </div>
  )
}

export const AccommodationImages = ({ images, title, withModal = true }: AccommodationImagesProps) => {
  const t = useTranslations('accomodation.images')
  const [mainImage, ...otherImages] = images
  const displayedImages = otherImages.slice(0, 4)

  // `calc(100% / 3)` plutôt que `33.33%` : la grille en face reçoit les deux tiers restants et
  // les redivise en deux, une valeur arrondie ferait diverger sa colonne de la photo principale.
  let widthStyle = '50%'
  if (images.length === 1) {
    widthStyle = '100%'
  } else if (images.length === 3) {
    widthStyle = 'calc(100% / 3)'
  }

  return (
    <div className={styles.container}>
      <div className={clsx(withModal && styles.cursor, styles.mainImageContainer)} style={{ width: widthStyle }}>
        <AccommodationImage
          src={mainImage}
          alt={photoAlt(t, 1, images.length, title)}
          openModalLabel={t('enlargePhoto', { index: 1, total: images.length })}
          className={styles.mainImage}
          width={400}
          height={300}
          withModal={withModal}
        />
        {!!withModal && !!title && (
          <div className={styles.photoCountButton}>
            <AccommodationImagesModal images={images} title={title}>
              <Button priority="tertiary no outline" nativeButtonProps={accommodationPicturesModal.buttonProps}>
                <span className={`ri-image-line ${styles.photoCount}`}>{t('photoCount', { count: images.length })}</span>
              </Button>
            </AccommodationImagesModal>
          </div>
        )}
      </div>

      {images.length > 1 && images.length < 4 && (
        <ImageGrid
          images={displayedImages}
          imageWidth={400}
          imageHeight={300}
          totalImages={images.length}
          withModal={withModal}
          title={title}
          offset={2}
        />
      )}
      {images.length >= 4 && (
        <ImageGrid
          images={displayedImages}
          imageWidth={200}
          imageHeight={150}
          totalImages={images.length}
          withModal={withModal}
          title={title}
          offset={2}
        />
      )}
    </div>
  )
}
