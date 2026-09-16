'use client'

import Tabs from '@codegouvfr/react-dsfr/Tabs'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'
import { DashboardResidences } from './dashboard-residences'
import { EngagementStatistics } from './engagement-statistics'

interface DashboardTabsProps {
  accommodations: TGetAccomodationsResponse
  page: number
  ownerId?: string
  canManageResidences: boolean
}

export function DashboardTabs({ accommodations, page, ownerId, canManageResidences }: DashboardTabsProps) {
  const t = useTranslations('bailleur.dashboard.tabs')
  const [selectedTabId, setSelectedTabId] = useState('residences')

  const tabs = [
    { tabId: 'residences', label: t('residences') },
    { tabId: 'statistics', label: t('statistics') },
  ]

  return (
    <Tabs selectedTabId={selectedTabId} onTabChange={setSelectedTabId} tabs={tabs}>
      <div className={selectedTabId === 'residences' ? '' : 'fr-hidden'}>
        <DashboardResidences accommodations={accommodations} page={page} ownerId={ownerId} canManageResidences={canManageResidences} />
      </div>
      <div className={selectedTabId === 'statistics' ? '' : 'fr-hidden'}>
        <EngagementStatistics ownerId={ownerId ? Number(ownerId) : undefined} />
      </div>
    </Tabs>
  )
}
