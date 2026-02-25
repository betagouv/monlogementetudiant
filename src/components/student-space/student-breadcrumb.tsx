'use client'

import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb'
import { useSelectedLayoutSegment } from 'next/navigation'
import { useTranslations } from 'next-intl'

const SEGMENT_LABELS: Record<string, string> = {
  'tableau-de-bord': 'breadcrumbs.student.dashboard.title',
  'to-do': 'breadcrumbs.student.todo.title',
  favoris: 'breadcrumbs.student.favorites.title',
  alertes: 'breadcrumbs.student.alerts.title',
}

export const StudentBreadcrumb = () => {
  const segment = useSelectedLayoutSegment()
  const t = useTranslations()
  const labelKey = SEGMENT_LABELS[segment ?? ''] ?? 'breadcrumbs.student.dashboard.title'

  return (
    <Breadcrumb
      currentPageLabel={t(labelKey)}
      homeLinkProps={{ href: '/', className: 'fr-text-inverted--grey' }}
      segments={[{ label: t('breadcrumbs.student.title'), linkProps: { href: '/mon-espace/tableau-de-bord' } }]}
      classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w breadcrumbInverted', link: 'fr-text-inverted--grey' }}
    />
  )
}
