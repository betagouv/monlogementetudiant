'use client'

import Image from 'next/image'
import { accommodationPicturesModal } from '~/components/accommodation/accommodation-images'
import styles from './accommodation-image.module.css'

export const AccommodationImage = ({
  width,
  height,
  className,
  src,
  alt,
  openModalLabel,
  withModal,
}: {
  width: number
  height: number
  className?: string
  src: string
  /** Alternative propre à cette photo : deux vignettes ne doivent pas se ressembler (RGAA 1.1). */
  alt: string
  /** Nom accessible du bouton d'agrandissement, quand la vignette ouvre la visionneuse. */
  openModalLabel?: string
  withModal: boolean
}) => {
  const image = <Image src={src} alt={alt} width={width} height={height} className={className} />

  if (!withModal) return image

  // Un <button> plutôt qu'un onClick sur l'image : la vignette reste atteignable au clavier (RGAA 7.3),
  // activable par Entrée/Espace et dotée d'un nom accessible.
  return (
    <button type="button" className={styles.trigger} onClick={() => accommodationPicturesModal.open()} aria-label={openModalLabel}>
      {image}
    </button>
  )
}
