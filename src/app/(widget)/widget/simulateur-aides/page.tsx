import { HelpSimulator } from '~/components/helps-simulator/help-simulator'
import { WidgetBodyStyle } from '~/components/widget/widget-body-style'

export const dynamic = 'force-dynamic'

export default async function WidgetSimulateurAidesPage() {
  return (
    <>
      <WidgetBodyStyle />
      {/* `_top` : sans cela le lien chargerait une page entière du site dans l'encart du partenaire. */}
      <HelpSimulator ctaTarget="_top" />
    </>
  )
}
