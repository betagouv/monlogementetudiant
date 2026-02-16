import Image from 'next/image'
import { parseAsString, useQueryState } from 'nuqs'

const PLACEHOLDER_IMAGES = [
  '/images/placeholder/logement-etudiant-chambre-1.jpg',
  '/images/placeholder/logement-etudiant-chambre-2.jpg',
  '/images/placeholder/logement-etudiant-chambre-3.jpg',
  '/images/placeholder/logement-etudiant-chambre-4.jpg',
  '/images/placeholder/logement-etudiant-chambre-5.jpg',
]

export const FindStudentAccommodationPlaceholderImageCard = ({ id = 0 }: { id?: number }) => {
  const [vue] = useQueryState('vue', parseAsString)
  const randomImage = PLACEHOLDER_IMAGES[Math.abs(id) % PLACEHOLDER_IMAGES.length]

  return (
    <Image
      style={{ objectFit: 'cover', width: '100%', height: '100%' }}
      src={randomImage}
      alt="Image placeholder d'une résidence"
      width={vue === 'carte' ? 332 : 390}
      height={193}
      priority
    />
  )
}

export const FindStudentAccommodationImageCard = ({ image, name }: { image: string; name: string }) => {
  const [vue] = useQueryState('vue', parseAsString)
  return (
    <Image
      style={{ objectFit: 'cover', width: '100%', height: '100%' }}
      src={image}
      alt={name}
      width={vue === 'carte' ? 344 : 390}
      height={193}
      priority
    />
  )
}
