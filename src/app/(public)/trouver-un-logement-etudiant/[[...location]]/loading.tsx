import { fr } from '@codegouvfr/react-dsfr'
import { CardSkeleton } from '~/components/ui/skeleton/card-skeleton'
import { Skeleton } from '~/components/ui/skeleton/skeleton'

export default function Loading() {
  return (
    <div className={fr.cx('fr-container')}>
      <Skeleton style={{ height: '2rem', width: '20rem', marginBottom: '1.5rem', marginTop: '1rem' }} />
      <Skeleton style={{ height: '3rem', width: '100%', marginBottom: '1.5rem' }} />
      <Skeleton style={{ height: '2rem', width: '14rem', marginBottom: '1rem' }} />
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {Array.from({ length: 24 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}
