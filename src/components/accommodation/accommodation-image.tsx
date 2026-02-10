'use client'

import Image from 'next/image'
import { accommodationPicturesModal } from '~/components/accommodation/accommodation-images'

export const AccommodationImage = ({
  width,
  height,
  className,
  src,
  withModal,
}: {
  width: number
  height: number
  className?: string
  src: string
  withModal: boolean
}) => {
  if (!withModal) {
    return <Image src={src} alt="Photo du logement" width={width} height={height} className={className} />
  }

  return (
    <button
      type="button"
      onClick={() => accommodationPicturesModal.open()}
      aria-label="Ouvrir la galerie de photos du logement"
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
    >
      <Image src={src} alt="Photo du logement" width={width} height={height} className={className} />
    </button>
  )
}
