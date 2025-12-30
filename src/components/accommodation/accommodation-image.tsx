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
  return (
    <Image
      src={src}
      alt="Photo du logement"
      width={width}
      height={height}
      className={className}
      {...(withModal && { onClick: () => accommodationPicturesModal.open() })}
    />
  )
}
