import { StudentAccommodationFavorite } from '~/components/student-space/favorites/student-accommodation-favorite'
import { getFavorites } from '~/server/student/get-favorites'
import { getServerSession } from '~/services/better-auth'
import styles from './student-favorites.module.css'

export const StudentFavorites = async () => {
  const session = await getServerSession()
  const favorites = await getFavorites()

  return (
    <div className={styles.container}>
      {favorites.results.map(({ accommodation }, index) => (
        <StudentAccommodationFavorite key={index} accomodation={accommodation} user={session?.user} />
      ))}
    </div>
  )
}
