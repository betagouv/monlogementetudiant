import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import Link from 'next/link'
import { AccomodationCard } from '~/components/find-student-accomodation/card/find-student-accomodation-card'
import { getAccommodations } from '~/server/accommodations/get-accommodations'
import styles from './prepare-student-life-nearby-accommodations.module.css'

interface PrepareStudentLifeNearbyAccommodationsProps {
  bbox: {
    xmax: number
    xmin: number
    ymax: number
    ymin: number
  }
  name: string
}

export default async function PrepareStudentLifeNearbyAccommodations({ bbox, name }: PrepareStudentLifeNearbyAccommodationsProps) {
  const formattedBbox = `${bbox.xmin},${bbox.ymin},${bbox.xmax},${bbox.ymax}`
  const accommodations = await getAccommodations({ bbox: formattedBbox })
  const accommodationsList = accommodations.results.features.slice(0, 6)
  return (
    <div className="primaryBackgroundColor">
      <div className={clsx(fr.cx('fr-container'), styles.accommodationGridContainer, 'fr-pt-6w')}>
        <h1 className={clsx('h1', styles.whiteTitle)}>Parmi les logements étudiants à {name}</h1>
        <div className={styles.accommodationGrid}>
          {accommodationsList.map((accommodation) => (
            <AccomodationCard key={accommodation.id} accomodation={accommodation} />
          ))}
        </div>
        <Button className="whiteButton" priority="tertiary" style={{ marginBottom: '4rem', marginTop: '4rem' }}>
          <Link href={`/trouver-un-logement-etudiant/ville/${name}`}>Plus de logements</Link>
        </Button>
      </div>
    </div>
  )
}
