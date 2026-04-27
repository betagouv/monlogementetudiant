'use client'

import Tabs from '@codegouvfr/react-dsfr/Tabs'
import { useState } from 'react'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'
import { DashboardResidences } from './dashboard-residences'
import { EngagementStatistics } from './engagement-statistics'

interface DashboardTabsProps {
  accommodations: TGetAccomodationsResponse
  page: number
  ownerId?: string
}

export function DashboardTabs({ accommodations, page, ownerId }: DashboardTabsProps) {
  const [selectedTabId, setSelectedTabId] = useState('residences')

  const tabs = [
    { tabId: 'residences', label: 'Résidences' },
    { tabId: 'statistics', label: 'Statistiques des visiteurs' },
  ]

  return (
    <Tabs selectedTabId={selectedTabId} onTabChange={setSelectedTabId} tabs={tabs}>
      <div className={selectedTabId === 'residences' ? '' : 'fr-hidden'}>
        <DashboardResidences accommodations={accommodations} page={page} ownerId={ownerId} />
      </div>
      <div className={selectedTabId === 'statistics' ? '' : 'fr-hidden'}>
        <EngagementStatistics ownerId={ownerId ? Number(ownerId) : undefined} />
      </div>
    </Tabs>
  )
}
