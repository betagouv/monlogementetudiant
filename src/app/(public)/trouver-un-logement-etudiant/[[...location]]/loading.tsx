import { CardSkeleton } from '~/components/ui/skeleton/card-skeleton'
import { Skeleton } from '~/components/ui/skeleton/skeleton'

export default function Loading() {
  return (
    <div className="fr-container">
      <Skeleton style={{ height: '1rem', width: '0', marginBottom: '1rem' }} />
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {Array.from({ length: 24 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}
