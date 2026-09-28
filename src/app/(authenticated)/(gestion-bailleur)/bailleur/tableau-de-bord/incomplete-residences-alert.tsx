import Alert from '@codegouvfr/react-dsfr/Alert'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Fragment } from 'react'
import { buildHref } from '~/utils/preserve-query-params'

const MAX_LINKS = 5

type IncompleteResidencesAlertProps = {
  residences: { name: string; slug: string }[]
  ownerId?: string
}

export async function IncompleteResidencesAlert({ residences, ownerId }: IncompleteResidencesAlertProps) {
  if (residences.length === 0) return null

  const t = await getTranslations('bailleur.dashboard.incompleteResidences')
  const hiddenCount = residences.length - MAX_LINKS

  return (
    <Alert
      severity="warning"
      className="fr-mb-4w"
      title={t('title')}
      description={
        <>
          {t('description', { count: residences.length })}
          <br />
          {residences.slice(0, MAX_LINKS).map((residence, index) => (
            <Fragment key={residence.slug}>
              {index > 0 && ' - '}
              <Link href={buildHref(`/bailleur/residences/${residence.slug}`, { ownerId })}>{residence.name}</Link>
            </Fragment>
          ))}
          {hiddenCount > 0 && (
            <>
              {' - '}
              <Link href={buildHref('/bailleur/residences', { ownerId })}>{t('more', { count: hiddenCount })}</Link>
            </>
          )}
        </>
      }
    />
  )
}
