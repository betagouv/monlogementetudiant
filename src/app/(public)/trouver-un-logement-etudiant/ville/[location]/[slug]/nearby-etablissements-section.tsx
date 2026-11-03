import { getNearbyEtablissements } from '~/server/accommodations/get-nearby-etablissements'
import { AccommodationNearbyEtablissements } from './accommodation-nearby-etablissements'

type NearbyEtablissementsSectionProps = {
  codePostal: string
  lat: number
  lng: number
}

export async function NearbyEtablissementsSection({ codePostal, lat, lng }: NearbyEtablissementsSectionProps) {
  const etablissements = await getNearbyEtablissements({ codePostal, lat, lng })
  return <AccommodationNearbyEtablissements etablissements={etablissements} />
}
