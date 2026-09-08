'use client'

import { useEffect, useRef } from 'react'
import { useDebounce } from 'use-debounce'
import { useBudgetSimulator } from '~/components/budget-simulation/budget-simulator-context'
import { useSaveBudgetSimulation } from '~/hooks/use-budget-simulation'

export function BudgetAutosave() {
  const { state } = useBudgetSimulator()
  const { mutateAsync: saveSimulation } = useSaveBudgetSimulation({ silent: true })
  const [debouncedState] = useDebounce(state, 1500)
  const lastSavedRef = useRef<string | null>(null)

  useEffect(() => {
    const serialized = JSON.stringify(debouncedState)

    if (lastSavedRef.current === null) {
      lastSavedRef.current = serialized
      return
    }
    if (serialized === lastSavedRef.current) return

    saveSimulation(debouncedState)
      .then(() => {
        lastSavedRef.current = serialized
      })
      .catch(() => undefined)
  }, [debouncedState, saveSimulation])

  return null
}
