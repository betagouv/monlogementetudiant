import { Notice } from '@codegouvfr/react-dsfr/Notice'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { TTerritories } from '~/schemas/territories'

export const FindStudentAccommodationBanner = async ({ territory }: { territory: TTerritories['cities'][0] }) => {
  const t = await getTranslations('findAccomodation.banner')

  return (
    <Notice
      description={t.rich('description', {
        link: (chunks) => (
          <Link className="fr-link fr-text--bold" style={{ color: 'unset' }} href="/alerte-logement" target="_self" rel="noreferrer">
            {chunks}
          </Link>
        ),
      })}
      title={t('title', { location: territory.name })}
      className="fr-mb-4w"
    />
  )
}
