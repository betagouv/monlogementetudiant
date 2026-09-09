'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { createContext, type ReactNode, useContext, useMemo } from 'react'
import { getWidgetNameFromPathname, normalizePartnerHost, type TWidgetCampaign } from '~/utils/widget-campaign'

const EMPTY_CAMPAIGN: TWidgetCampaign = { partner: null, widget: null }

const WidgetCampaignContext = createContext<TWidgetCampaign>(EMPTY_CAMPAIGN)

/**
 * Origine de la page courante lorsqu'elle est affichée dans un widget partenaire.
 *
 * Les composants partagés avec le site principal (cartes de résidence…) lisent ce contexte plutôt
 * que les paramètres d'URL : hors widget, aucun provider n'est monté, la valeur par défaut suffit,
 * et ces composants n'ont pas à s'abonner aux paramètres de recherche pour autant.
 */
export const useWidgetCampaign = (): TWidgetCampaign => useContext(WidgetCampaignContext)

export function WidgetCampaignProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const campaign = useMemo<TWidgetCampaign>(() => {
    // `referrer` est posé par les scripts d'intégration (public/widget/embed*.js). Une iframe
    // recopiée à la main n'en a pas : on retombe sur le référent du document, qui vaut l'URL de la
    // page hôte.
    const partner =
      normalizePartnerHost(searchParams.get('referrer')) ?? normalizePartnerHost(typeof document === 'undefined' ? null : document.referrer)

    return { partner, widget: getWidgetNameFromPathname(pathname) }
  }, [pathname, searchParams])

  return <WidgetCampaignContext.Provider value={campaign}>{children}</WidgetCampaignContext.Provider>
}
