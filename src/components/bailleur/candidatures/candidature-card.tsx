'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import { Card } from '@codegouvfr/react-dsfr/Card'
import clsx from 'clsx'
import dayjs from 'dayjs'
import { useRouter } from 'next/navigation'
import { APARTMENT_TYPE_LABELS, type ApartmentType } from '~/enums/apartment-type'
import styles from './candidature-card.module.css'

const STATUS_CONFIG = {
  pending: { label: 'A modérer', severity: 'new' },
  accepted: { label: 'Accepté', severity: 'success' },
  rejected: { label: 'Refusé', severity: 'error' },
} as const

interface CandidatureItem {
  id: string
  studentName: string | null
  studentEmail: string | null
  residence: string | null
  apartmentType: string
  status: string
  createdAt: Date | string
  pdfUrl: string | null
  accommodationSlug: string
}

interface Props {
  candidature: CandidatureItem
}

export const CandidatureCard = ({ candidature }: Props) => {
  const router = useRouter()
  const statusConfig = STATUS_CONFIG[candidature.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending

  return (
    <Card
      background
      border
      size="small"
      classes={{ root: styles.hover, endDetail: 'fr-justify-content-end' }}
      nativeDivProps={{ onClick: () => router.push(`/bailleur/candidatures/${candidature.id}`) }}
      title={<span className="fr-text-title--blue-france fr-mb-0">{candidature.studentName ?? 'Candidat'}</span>}
      titleAs="h3"
      start={
        <>
          <Badge severity={statusConfig.severity} noIcon>
            {statusConfig.label}
          </Badge>
          <span className="fr-text-mention--grey fr-text--xs fr-mt-1v" style={{ display: 'block' }}>
            Postée le {dayjs(candidature.createdAt).format('DD MMMM YYYY')}
          </span>
        </>
      }
      desc={
        <>
          <span className="fr-text-mention--grey fr-text--sm ri-building-line">{candidature.residence ?? 'Résidence'}</span>
          <br />
          <span className="fr-text-mention--grey fr-text--sm ri-home-line">
            {APARTMENT_TYPE_LABELS[candidature.apartmentType as ApartmentType] ?? candidature.apartmentType}
          </span>
        </>
      }
      endDetail={<span className={clsx('ri-arrow-right-line fr-text-title--blue-france', styles.arrow)} />}
    />
  )
}
