'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import clsx from 'clsx'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type ReactNode } from 'react'
import { CONTACT_STATUS_CONFIG, CONTACT_STATUSES, EContactStatus } from '~/enums/contact-status'
import type { TContactDetail } from '~/schemas/contacts/contact-detail'
import { buildHref } from '~/utils/preserve-query-params'
import styles from './contact-detail.module.css'

interface Props {
  contact: TContactDetail
  slug: string
  children: ReactNode
  actions: ReactNode
}

export const ContactDetailLayout = ({ contact, slug, children, actions }: Props) => {
  const t = useTranslations('bailleur.contacts')
  const searchParams = useSearchParams()
  const status = CONTACT_STATUSES.includes(contact.status as EContactStatus)
    ? (contact.status as EContactStatus)
    : EContactStatus.A_CONTACTER
  const config = CONTACT_STATUS_CONFIG[status]
  const name = contact.studentName ?? t('defaultCandidateName')

  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={name}
        segments={[
          { label: t('breadcrumbDashboard'), linkProps: { href: buildHref('/bailleur/tableau-de-bord', searchParams) } },
          { label: t('breadcrumbContacts'), linkProps: { href: buildHref('/bailleur/contacts', searchParams) } },
          {
            label: t('residenceTitle', { name: contact.accommodationName }),
            linkProps: { href: buildHref(`/bailleur/contacts/${slug}`, searchParams) },
          },
        ]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />

      <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-flex-gap-2v fr-mb-4w">
        <h1 className="fr-h2 fr-mb-0">{t('detail.title', { name })}</h1>
        <Badge severity={config.severity ?? undefined} noIcon>
          {t(`status.${status}`)}
        </Badge>
      </div>

      <div className="fr-border-top">
        <div className={clsx(styles.detailGrid, 'fr-pt-4w')}>
          <div>
            <div className="fr-background-default--grey fr-border fr-p-8w">{children}</div>
          </div>
          <div>{actions}</div>
        </div>
      </div>
    </div>
  )
}
