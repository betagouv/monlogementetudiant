import Button from '@codegouvfr/react-dsfr/Button'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import clsx from 'clsx'
import { AccommodationImage } from '~/components/accommodation/accommodation-image'
import { AccommodationImagesModal } from '~/components/accommodation/accommodation-images-modal'
import { sPluriel } from '~/utils/sPluriel'
import styles from './accommodation-images.module.css'

interface AccommodationImagesProps {
  images: string[]
  title: string
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
}

function ImageGrid({ images, imageWidth, imageHeight, totalImages }: ImageGridProps) {
  return (
    <div className={clsx('fr-hidden fr-unhidden-sm', styles.gridContainer)} data-images={totalImages}>
      <div className={styles.imageGrid}>
        {images.map((image, index) => (
          <AccommodationImage key={index} src={image} width={imageWidth} height={imageHeight} />
        ))}
      </div>
    </div>
  )
}

export const AccommodationImages = ({ images, title }: AccommodationImagesProps) => {
  const [mainImage, ...otherImages] = images
  const displayedImages = otherImages.slice(0, 4)

  let widthStyle = '50%'
  if (images.length === 1) {
    widthStyle = '100%'
  } else if (images.length === 3) {
    widthStyle = '33.33%'
  }

  return (
    <div className={styles.container}>
      <div className={styles.mainImageContainer} style={{ width: widthStyle }}>
        <AccommodationImage src={mainImage} className={styles.mainImage} width={400} height={300} />
        <div className={styles.photoCountButton}>
          <AccommodationImagesModal images={images} title={title}>
            <Button priority="tertiary no outline" nativeButtonProps={accommodationPicturesModal.buttonProps}>
              <span className={`ri-image-line ${styles.photoCount}`}>
                {images.length} photo{sPluriel(images.length)}
              </span>
            </Button>
          </AccommodationImagesModal>
        </div>
      </div>

      {images.length > 1 && images.length < 4 && (
        <ImageGrid images={displayedImages} imageWidth={400} imageHeight={300} totalImages={images.length} />
      )}
      {images.length >= 4 && <ImageGrid images={displayedImages} imageWidth={200} imageHeight={150} totalImages={images.length} />}
    </div>
  )
}
