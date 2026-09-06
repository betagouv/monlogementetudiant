'use client'

import { useEffect, useRef } from 'react'
import { useWidgetCampaign } from '~/components/widget/widget-campaign-context'
import { trackEvent } from '~/lib/tracking'

/**
 * Signale l'affichage d'un widget chez un partenaire (W1).
 *
 * Monté dans la mise en page des widgets, il couvre les trois intégrations — le suivi ne vivait
 * auparavant que dans la grille de logements. Le widget concerné se lit dans l'URL de page
 * enregistrée par Matomo (`/widget/<nom>`), le libellé de l'événement reste le seul hostname du
 * partenaire pour ne pas rompre l'historique du rapport.
 */
export function WidgetLoadTracker() {
  const { partner, widget } = useWidgetCampaign()
  const trackedRef = useRef(false)

  useEffect(() => {
    if (trackedRef.current || !widget || !partner) return
    trackedRef.current = true
    trackEvent({ category: 'Widget', action: 'chargement widget', name: partner })
  }, [partner, widget])

  return null
}
