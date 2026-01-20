import { Notice } from '@codegouvfr/react-dsfr/Notice'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { TTerritory } from '~/schemas/territories'

export const FindStudentAccommodationBanner = async ({ territory, categoryKey }: { territory: TTerritory; categoryKey?: string }) => {
  const t = await getTranslations('findAccomodation.banner')

  const territoryType = categoryKey === 'ville' ? 'city' : categoryKey === 'academie' ? 'academy' : 'department'
  console.log(territoryType)

  return (
    <Notice
      description={t.rich('description', {
        link: (chunks) => (
          <Link className="fr-link fr-text--bold" style={{ color: 'unset' }} href="/alerte-logement" target="_self" rel="noreferrer">
            {chunks}
          </Link>
        ),
      })}
      title={t(`title.${territoryType}`, { location: territory.name })}
      className="fr-mb-4w"
    />
  )
}
