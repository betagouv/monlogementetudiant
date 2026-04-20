import { BudgetSimulatorContent } from '~/app/(public)/simuler-budget/budget-simulator-content'
import { BudgetSimulatorProvider } from '~/components/budget-simulation/budget-simulator-context'
import { WidgetBodyStyle } from '~/components/widget/widget-body-style'

export const dynamic = 'force-dynamic'

export default async function WidgetCalculatricePage() {
  return (
    <>
      <WidgetBodyStyle />
      <BudgetSimulatorProvider>
        <BudgetSimulatorContent />
      </BudgetSimulatorProvider>
    </>
  )
}
