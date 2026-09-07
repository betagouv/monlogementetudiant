import { BudgetSimulatorContent } from '~/app/(public)/simuler-budget/budget-simulator-content'
import { BudgetSimulatorProvider } from '~/components/budget-simulation/budget-simulator-context'
import { WidgetBodyStyle } from '~/components/widget/widget-body-style'

export const dynamic = 'force-dynamic'

export default async function WidgetCalculatricePage() {
  return (
    <>
      <WidgetBodyStyle />
      <BudgetSimulatorProvider>
        {/* `_top` : sans cela le lien chargerait une page entière du site dans l'encart du partenaire. */}
        <BudgetSimulatorContent ctaTarget="_top" />
      </BudgetSimulatorProvider>
    </>
  )
}
