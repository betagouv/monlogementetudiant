import { StudentAccommodationFavorite } from '~/components/student-space/favorites/student-accommodation-favorite'
import { getFavorites } from '~/server-only/student/get-favorites'
import styles from './student-favorites.module.css'

export const StudentFavorites = async () => {
  const favorites = await getFavorites()

  return (
    <div className={styles.container}>
      {favorites.results.map(({ accommodation }, index) => (
        <StudentAccommodationFavorite key={index} accomodation={accommodation} />
      ))}
    </div>
  )
}
