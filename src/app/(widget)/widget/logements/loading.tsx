import { CardSkeleton } from '~/components/ui/skeleton/card-skeleton'
import styles from '~/components/widget/widget-accommodation-grid.module.css'

export default function Loading() {
  return (
    <div>
      <div className={styles.grid}>
        {Array.from({ length: 6 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}
