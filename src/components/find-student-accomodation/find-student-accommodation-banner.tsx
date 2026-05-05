import { Notice } from '@codegouvfr/react-dsfr/Notice'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { AlertsLoginRequiredInlineLink } from '~/components/auth/login-required-inline-link'
import { TTerritory } from '~/schemas/territories'
import { getServerSession } from '~/services/better-auth'
import { formatCityWithA } from '~/utils/french-contraction'

export const FindStudentAccommodationBanner = async ({ territory, categoryKey }: { territory: TTerritory; categoryKey?: string }) => {
  const t = await getTranslations('findAccomodation.banner')
  const auth = await getServerSession()
  const isAuthenticated = !!auth?.user

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
        link: (chunks) =>
          isAuthenticated ? (
            <Link className="fr-link fr-text--bold" style={{ color: 'unset' }} href="/mon-espace/alertes" target="_self" rel="noreferrer">
              {chunks}
            </Link>
          ) : (
            <AlertsLoginRequiredInlineLink className="fr-link fr-text--bold">{chunks}</AlertsLoginRequiredInlineLink>
          ),
      })}
      title={title}
      className="fr-mb-4w"
    />
  )
}
