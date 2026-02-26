import { HydrationBoundary } from '@tanstack/react-query'
import { getServerSession } from '~/auth'
import { StudentAccommodationFavorite } from '~/components/student-space/favorites/student-accommodation-favorite'
import { getFavorites, prefetchFavorites } from '~/server-only/student/get-favorites'
import styles from './student-favorites.module.css'

export const StudentFavorites = async () => {
  const session = await getServerSession()
  const [favorites, dehydratedFavorites] = await Promise.all([getFavorites(), prefetchFavorites()])

  return (
    <HydrationBoundary state={dehydratedFavorites}>
      <div className={styles.container}>
        {favorites.results.map(({ accommodation }, index) => (
          <StudentAccommodationFavorite key={index} accomodation={accommodation} user={session?.user} />
        ))}
      </div>
    </HydrationBoundary>
  )
}
