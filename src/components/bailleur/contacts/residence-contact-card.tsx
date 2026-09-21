'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import clsx from 'clsx'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { buildHref } from '~/utils/preserve-query-params'
import styles from './residence-contact-card.module.css'

interface Props {
  slug: string
  name: string
  cityName: string | null
  departmentCode: string | null
  aRappelerCount: number
  applicationsSuspended: boolean
}

export const ResidenceContactCard = ({ slug, name, cityName, departmentCode, aRappelerCount, applicationsSuspended }: Props) => {
  const t = useTranslations('bailleur.contacts')
  const router = useRouter()
  const searchParams = useSearchParams()

  const location = cityName ? `${cityName}${departmentCode ? ` (${departmentCode})` : ''}` : null

  return (
    <button
      type="button"
      className={clsx(
        'fr-flex fr-direction-column fr-align-items-center fr-flex-gap-2v fr-width-full fr-text--center',
        'fr-background-default--grey fr-border fr-cursor-pointer fr-px-2w fr-pt-4w fr-pb-3w',
        styles.card,
      )}
      onClick={() => router.push(buildHref(`/bailleur/contacts/${slug}`, searchParams))}
    >
      <span className={clsx('fr-text--xl fr-text--bold fr-mb-0', styles.title)}>{name}</span>
      <span className={clsx('fr-text--sm fr-text-mention--grey fr-mb-0', styles.location)}>{location}</span>
      <span className={clsx('fr-mt-1w fr-text--uppercase', styles.badge)}>
        <Badge severity="new" small noIcon>
          {t('toBeCalledBack', { count: aRappelerCount })}
        </Badge>
      </span>
      {applicationsSuspended && (
        <Badge severity="warning" small>
          {t('applicationsSuspendedBadge')}
        </Badge>
      )}
    </button>
  )
}
