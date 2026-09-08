'use client'

import { useEffect, useRef } from 'react'
import { useSaveBudgetSimulation } from '~/hooks/use-budget-simulation'
import { useSaveHousingAidSimulation } from '~/hooks/use-housing-aid-simulation'
import { clearPendingAidSimulation, readPendingAidSimulation } from '~/utils/pending-aid-simulation'
import { clearPendingBudgetSimulation, readPendingBudgetSimulation } from '~/utils/pending-budget-simulation'

export const PendingSimulationSaver = () => {
  const { mutateAsync: saveAidSimulation } = useSaveHousingAidSimulation({ silent: true })
  const { mutateAsync: saveBudgetSimulation } = useSaveBudgetSimulation({ silent: true })
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const pendingAid = readPendingAidSimulation()
    if (pendingAid) {
      saveAidSimulation(pendingAid)
        .then(() => clearPendingAidSimulation())
        .catch(() => undefined)
    }

    const pendingBudget = readPendingBudgetSimulation()
    if (pendingBudget) {
      saveBudgetSimulation(pendingBudget)
        .then(() => clearPendingBudgetSimulation())
        .catch(() => undefined)
    }
  }, [saveAidSimulation, saveBudgetSimulation])

  return null
}
