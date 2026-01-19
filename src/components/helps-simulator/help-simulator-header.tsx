'use client'

import { HelpsSimulatorStepper } from '~/components/helps-simulator/helps-simulator-stepper'
import { HelpSimulatorHeaderResults } from '~/components/helps-simulator/results/help-simulator-results-header'

export const HelpSimulatorHeader = () => {
  return (
    <>
      <HelpsSimulatorStepper />
      <HelpSimulatorHeaderResults />
    </>
  )
}
