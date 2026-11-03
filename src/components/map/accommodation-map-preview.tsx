'use client'

import { Badge } from '@codegouvfr/react-dsfr/Badge'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { FC, useEffect } from 'react'
import { AvailabilityBadge } from '~/components/shared/availability-badge'
import { trackEvent } from '~/lib/tracking'
import { useTRPC } from '~/server/trpc/client'
import { calculateAvailability } from '~/utils/calculateAvailability'
import { getAccommodationPath } from '~/utils/get-accommodation-url'

export const AccommodationMapPreview: FC<{ id: number; onLoaded?: () => void }> = ({ id, onLoaded }) => {
  const t = useTranslations('map')
  const tCard = useTranslations('findAccomodation.card')
  const trpc = useTRPC()
  const { data: accommodation, isPending, isError } = useQuery(trpc.accommodations.mapPreview.queryOptions({ id }))

  useEffect(() => {
    if (!isPending) onLoaded?.()
  }, [isPending, onLoaded])

  if (isPending) return <p className="fr-text--sm fr-m-0">{t('previewLoading')}</p>
  if (isError) return <p className="fr-text--sm fr-m-0">{t('previewError')}</p>

  return (
    <div>
      <p className="fr-text--bold fr-mb-1v">{accommodation.name}</p>
      <p className="fr-text--sm fr-mb-1w">{`${accommodation.city} (${accommodation.postalCode})`}</p>
      <ul className="fr-badges-group fr-mb-1w">
        {!!accommodation.priceMin && (
          <li>
            <Badge severity="new" noIcon small>{`${tCard('priceFrom')} ${accommodation.priceMin}€`}</Badge>
          </li>
        )}
        <li>
          <AvailabilityBadge
            nbAvailable={calculateAvailability(accommodation.typologies)}
            noAvailabilityText={tCard('noAvailability')}
            availabilityText={(count) => tCard('availabilityCount', { count })}
            unknownAvailabilityText={tCard('unknownAvailability')}
            as="span"
          />
        </li>
      </ul>
      <Link
        className="fr-link fr-link--sm fr-icon-arrow-right-line fr-link--icon-right"
        href={getAccommodationPath(accommodation.city, accommodation.slug)}
        onClick={() => trackEvent({ category: 'Logement', action: 'clic popup carte logement', name: accommodation.slug })}
      >
        {t('previewLink')}
      </Link>
    </div>
  )
}
