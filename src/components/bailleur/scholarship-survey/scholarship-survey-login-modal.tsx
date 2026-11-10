'use client'

import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { buildHref } from '~/utils/preserve-query-params'

const DISMISSED_KEY = 'jde-scholarship-survey-dismissed'
const SURVEY_PATH = '/bailleur/enquete-boursiers'

const scholarshipSurveyLoginModal = createModal({ id: 'scholarship-survey-login-modal', isOpenedByDefault: false })

export function ScholarshipSurveyLoginModal({ schoolYear }: { schoolYear: string }) {
  const t = useTranslations('bailleur.scholarshipSurvey.loginModal')
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname === SURVEY_PATH || sessionStorage.getItem(DISMISSED_KEY) === 'true') return
    sessionStorage.setItem(DISMISSED_KEY, 'true')
    scholarshipSurveyLoginModal.open()
  }, [pathname])

  return (
    <scholarshipSurveyLoginModal.Component
      title={t('title')}
      buttons={[
        { children: t('later'), priority: 'secondary' },
        { children: t('answer'), linkProps: { href: buildHref(SURVEY_PATH, searchParams) } },
      ]}
    >
      <p className="fr-mb-0">{t('description', { year: schoolYear })}</p>
    </scholarshipSurveyLoginModal.Component>
  )
}
