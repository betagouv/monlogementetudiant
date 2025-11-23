import { StudentAccommodationFavorite } from '~/components/student-space/favorites/student-accommodation-favorite'
import { getAccommodations } from '~/server-only/get-accommodations'
import styles from './student-favorites.module.css'

export const StudentFavorites = async () => {
  // todo - remove it (mock)
  const accommodations = await getAccommodations({})
  const mock = accommodations.results.features.slice(0, 3)

  return (
    <div className={styles.container}>
      {mock.map((accommodation, index) => (
        <StudentAccommodationFavorite key={index} accomodation={accommodation} />
      ))}
    </div>
  )
}
