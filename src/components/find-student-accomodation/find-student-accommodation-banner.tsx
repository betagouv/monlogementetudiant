import { Notice } from '@codegouvfr/react-dsfr/Notice'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { TTerritory } from '~/schemas/territories'
import { formatCityWithA } from '~/utils/french-contraction'

export const FindStudentAccommodationBanner = async ({ territory, categoryKey }: { territory: TTerritory; categoryKey?: string }) => {
  const t = await getTranslations('findAccomodation.banner')

  const territoryType = categoryKey === 'ville' ? 'city' : categoryKey === 'academie' ? 'academy' : 'department'
  let title = t('title.department', { location: territory.name })
  if (territoryType === 'city') {
    title = t('title.city', { locationFormatted: formatCityWithA(territory.name) })
  }
  if (territoryType === 'academy') {
    title = t('title.academy', { location: territory.name })
  }

  return (
    <Notice
      description={t.rich('description', {
        link: (chunks) => (
          <Link className="fr-link fr-text--bold" style={{ color: 'unset' }} href="/alerte-logement" target="_self" rel="noreferrer">
            {chunks}
          </Link>
        ),
      })}
      title={title}
      className="fr-mb-4w"
    />
  )
}
