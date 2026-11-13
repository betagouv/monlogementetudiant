'use client'

import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export const scholarshipSurveyMissingModal = createModal({ id: 'scholarship-survey-missing-modal', isOpenedByDefault: false })

export function ScholarshipSurveyMissingModal({
  missing,
  dashboardHref,
}: {
  missing: { id: number; name: string }[]
  dashboardHref: string
}) {
  const t = useTranslations('bailleur.scholarshipSurvey.missingModal')
  const router = useRouter()

  return (
    <scholarshipSurveyMissingModal.Component
      title={t('title')}
      buttons={[
        { children: t('dashboard'), priority: 'secondary', doClosesModal: true, onClick: () => router.push(dashboardHref) },
        { children: t('continue'), doClosesModal: true },
      ]}
    >
      <p>{t('description', { count: missing.length })}</p>
      <ul>
        {missing.map((residence) => (
          <li key={residence.id}>{residence.name}</li>
        ))}
      </ul>
      <p className="fr-mb-0">{t('hint')}</p>
    </scholarshipSurveyMissingModal.Component>
  )
}
