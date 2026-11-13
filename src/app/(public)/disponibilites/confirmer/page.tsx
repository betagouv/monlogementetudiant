import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import { Card } from '@codegouvfr/react-dsfr/Card'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { EmailConfirmAvailabilityForm, EmailConfirmLinkFailure } from '~/components/bailleur/email-confirm-availability'
import { AVAILABILITY_CONFIRM_COOKIE, readEmailConfirmation } from '~/server/bailleur/availability-email-confirmation'
import { formatLongDay } from '~/utils/formatDate'

export const dynamic = 'force-dynamic'

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations('bailleur.emailConfirmAvailability')
  return { title: t('pageTitle'), robots: { index: false, follow: false } }
}

/** Toutes les résidences ont été confirmées ou mises à jour depuis l'envoi de l'e-mail. */
const isUpToDate = ({ residences, issuedAt }: { residences: { lastUpdatedAt: Date | null }[]; issuedAt: Date }) =>
  residences.every((r) => r.lastUpdatedAt !== null && r.lastUpdatedAt > issuedAt)

export default async function EmailConfirmAvailabilityPage({ searchParams }: { searchParams: Promise<{ lien?: string }> }) {
  const { lien } = await searchParams
  const t = await getTranslations('bailleur.emailConfirmAvailability')
  const confirmation = lien ? null : await readEmailConfirmation((await cookies()).get(AVAILABILITY_CONFIRM_COOKIE)?.value)

  const content = () => {
    if (!confirmation?.ok) {
      return <EmailConfirmLinkFailure reason={lien === 'expire' || confirmation?.reason === 'expired' ? 'expired' : 'invalid'} />
    }

    if (isUpToDate(confirmation)) {
      return (
        <>
          <p>{t('upToDateDescription')}</p>
          <Button priority="secondary" linkProps={{ href: '/bailleur/residences' }}>
            {t('update')}
          </Button>
        </>
      )
    }

    return (
      <>
        <p className="fr-text--lead">{t('intro')}</p>
        <p>{t('confirmHint')}</p>
        <ul className="fr-raw-list fr-mb-4w">
          {confirmation.residences.map((residence) => (
            <li key={residence.id} className="fr-mb-2w">
              <Card
                border
                size="small"
                titleAs="h2"
                title={residence.name}
                desc={residence.city ?? undefined}
                start={
                  <Badge severity={residence.nbAvailable > 0 ? 'success' : 'info'} small noIcon>
                    {t('available', { count: residence.nbAvailable })}
                  </Badge>
                }
                end={
                  <p className="fr-text--sm fr-mb-0">
                    {residence.lastUpdatedAt ? t('lastUpdate', { date: formatLongDay(residence.lastUpdatedAt) }) : t('neverUpdated')}
                  </p>
                }
              />
            </li>
          ))}
        </ul>
        <EmailConfirmAvailabilityForm />
      </>
    )
  }

  return (
    <div className="fr-container fr-py-6w">
      <h1>{confirmation?.ok && isUpToDate(confirmation) ? t('upToDateTitle') : t('pageTitle')}</h1>
      {content()}
    </div>
  )
}
