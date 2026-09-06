/**
 * Marquage des liens qui sortent d'un widget intégré chez un partenaire.
 *
 * Un widget est une iframe hébergée sur le site du partenaire : lorsqu'un visiteur clique sur un
 * de ses liens, il atterrit sur le site principal et Matomo n'enregistre qu'un référent — le même
 * que pour un lien classique posé sur ce site. Rien ne distingue donc les deux origines.
 *
 * On ajoute donc aux liens sortants les paramètres de campagne de Matomo. `mtm_campaign` et
 * `mtm_kwd` sont reconnus par le cœur de Matomo, sans extension : ils portent à eux seuls les deux
 * informations attendues, « la visite vient d'un widget » et « de quel partenaire ». Les trois
 * autres ne sont exploités que si l'extension Marketing Campaigns Reporting est installée ; ils
 * sont sans effet sinon, et affinent le rapport là où elle l'est.
 */

/** Valeur de `mtm_campaign` commune à tous les widgets : isole les visites d'origine widget. */
export const WIDGET_CAMPAIGN = 'widget'

export const WIDGET_NAMES = ['logements', 'calculatrice', 'simulateur-aides'] as const

export type TWidgetName = (typeof WIDGET_NAMES)[number]

export type TWidgetCampaign = {
  /** Hostname du site partenaire qui héberge le widget. */
  partner: string | null
  widget: TWidgetName | null
}

/**
 * Ramène une valeur d'origine (attribut `data-referrer` de l'embed, ou `document.referrer`) au seul
 * hostname. Les partenaires transmettent tantôt un hostname, tantôt une URL complète ; une URL
 * entière ferait de chaque page d'intégration un mot-clé de campagne distinct.
 */
export function normalizePartnerHost(value: string | null | undefined): string | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname || null
  } catch {
    return null
  }
}

/** Nom du widget déduit du chemin. `null` hors des pages widget : les liens ne sont alors pas marqués. */
export function getWidgetNameFromPathname(pathname: string | null | undefined): TWidgetName | null {
  if (!pathname) return null
  const match = pathname.match(/^\/widget\/([^/?#]+)/)
  const name = match?.[1]
  return WIDGET_NAMES.includes(name as TWidgetName) ? (name as TWidgetName) : null
}

/** Paramètres de campagne pour un widget donné. Vide hors contexte widget. */
export function buildWidgetCampaignParams({ partner, widget }: TWidgetCampaign): Record<string, string> {
  if (!widget) return {}

  const params: Record<string, string> = {
    mtm_campaign: WIDGET_CAMPAIGN,
    mtm_medium: WIDGET_CAMPAIGN,
    mtm_content: widget,
  }

  // Sans partenaire identifié (iframe intégrée à la main, référent masqué), la visite reste
  // rattachée à la campagne « widget » : c'est déjà plus précis qu'un référent brut.
  if (partner) {
    params.mtm_kwd = partner
    params.mtm_source = partner
  }

  return params
}

/**
 * Ajoute le marquage de campagne à un lien, relatif ou absolu. Les paramètres déjà présents sont
 * conservés ; le lien est rendu inchangé hors contexte widget.
 */
export function appendWidgetCampaign(href: string, campaign: TWidgetCampaign): string {
  const campaignParams = buildWidgetCampaignParams(campaign)
  if (Object.keys(campaignParams).length === 0) return href

  const [beforeHash, ...hashParts] = href.split('#')
  const hash = hashParts.length > 0 ? `#${hashParts.join('#')}` : ''
  const [path, ...queryParts] = beforeHash.split('?')

  const params = new URLSearchParams(queryParts.join('?'))
  for (const [key, value] of Object.entries(campaignParams)) params.set(key, value)

  return `${path}?${params.toString()}${hash}`
}
