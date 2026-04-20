import { HelpSimulator } from '~/components/helps-simulator/help-simulator'
import { WidgetBodyStyle } from '~/components/widget/widget-body-style'

export const dynamic = 'force-dynamic'

export default async function WidgetSimulateurAidesPage() {
  return (
    <>
      <WidgetBodyStyle />
      <HelpSimulator />
    </>
  )
}
