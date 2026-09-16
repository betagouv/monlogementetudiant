'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import clsx from 'clsx'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { forwardRef, type HTMLAttributes } from 'react'
import { EContactSource } from '~/enums/contact-source'
import { CONTACT_STATUS_CONFIG, CONTACT_STATUSES, EContactStatus } from '~/enums/contact-status'
import { formatDayjs } from '~/utils/dayjs'
import { buildHref } from '~/utils/preserve-query-params'
import styles from './contact-card.module.css'

export interface ContactItem {
  id: string
  studentName: string | null
  scholarshipStatus: string | null
  apartmentType: string | null
  status: string
  createdAt: string | Date
  source: EContactSource
}

interface Props extends HTMLAttributes<HTMLDivElement> {
  contact: ContactItem
  slug: string
  /** Carte inerte (overlay de drag) : pas de lien ni d'ombre de survol. */
  overlay?: boolean
}

export const ContactCard = forwardRef<HTMLDivElement, Props>(({ contact, slug, overlay, className, ...rest }, ref) => {
  const t = useTranslations('bailleur.contacts')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const status = CONTACT_STATUSES.includes(contact.status as EContactStatus) ? (contact.status as EContactStatus) : EContactStatus.A_MODERER
  const config = CONTACT_STATUS_CONFIG[status]
  const studentName = contact.studentName ?? t('defaultCandidateName')
  const href = buildHref(`/bailleur/contacts/${slug}/${contact.id}`, searchParams)

  return (
    <div
      ref={ref}
      className={clsx(
        'fr-flex fr-direction-column fr-flex-gap-1v fr-p-2w fr-background-default--grey fr-border',
        styles.card,
        overlay && styles.overlay,
        className,
      )}
      style={{ borderBottomColor: config.barColor }}
      {...rest}
    >
      <Badge severity={config.severity ?? undefined} noIcon>
        {t(`status.${status}`)}
      </Badge>

      <span className="fr-text-mention--grey fr-text--xs fr-mt-1v fr-mb-2v">
        {t('card.postedOn', { date: formatDayjs(contact.createdAt, 'DD MMMM YYYY', locale) })}
      </span>

      <span
        className={clsx(
          'fr-h6 fr-text-title--blue-france fr-mb-0',
          contact.status === EContactStatus.NON_RETENU ? 'fr-text-default--grey' : styles.nameActive,
        )}
      >
        {studentName}
      </span>

      {contact.scholarshipStatus === 'yes' && (
        <span className="ri-money-euro-circle-line fr-text--sm fr-text-mention--grey fr-mb-0"> {t('card.scholarship')}</span>
      )}

      <div className="fr-flex fr-align-items-center fr-justify-content-space-between fr-mt-1w">
        {contact.source === EContactSource.DOSSIER_FACILE && (
          <span className="fr-text--sm fr-text-default--grey" aria-label="DossierFacile">
            Dossier<strong>Facile</strong>
          </span>
        )}
        {!overlay && (
          <Link
            href={href}
            className={clsx('ri-arrow-right-line fr-link--no-underline fr-text-title--blue-france', styles.cardLink)}
            aria-label={t('card.viewCandidate', { name: contact.studentName ?? t('card.viewCandidateFallback') })}
          />
        )}
      </div>
    </div>
  )
})
