import { describe, expect, it } from 'vitest'
import {
  appendWidgetCampaign,
  buildWidgetCampaignParams,
  getWidgetNameFromPathname,
  normalizePartnerHost,
  WIDGET_CAMPAIGN,
} from './widget-campaign'

describe('normalizePartnerHost', () => {
  it('accepte un hostname nu comme une URL complète', () => {
    expect(normalizePartnerHost('crous-paris.fr')).toBe('crous-paris.fr')
    expect(normalizePartnerHost('https://crous-paris.fr/logement?page=2')).toBe('crous-paris.fr')
  })

  it('ignore une valeur vide ou inexploitable', () => {
    expect(normalizePartnerHost(null)).toBeNull()
    expect(normalizePartnerHost('   ')).toBeNull()
    expect(normalizePartnerHost('http://')).toBeNull()
  })
})

describe('getWidgetNameFromPathname', () => {
  it('reconnaît les trois widgets', () => {
    expect(getWidgetNameFromPathname('/widget/logements')).toBe('logements')
    expect(getWidgetNameFromPathname('/widget/calculatrice')).toBe('calculatrice')
    expect(getWidgetNameFromPathname('/widget/simulateur-aides')).toBe('simulateur-aides')
  })

  it('ne reconnaît rien hors des pages widget', () => {
    expect(getWidgetNameFromPathname('/trouver-un-logement-etudiant')).toBeNull()
    expect(getWidgetNameFromPathname('/widget/inconnu')).toBeNull()
    expect(getWidgetNameFromPathname(null)).toBeNull()
  })
})

describe('buildWidgetCampaignParams', () => {
  it('porte la campagne, le partenaire et le widget', () => {
    expect(buildWidgetCampaignParams({ partner: 'crous-paris.fr', widget: 'logements' })).toEqual({
      mtm_campaign: WIDGET_CAMPAIGN,
      mtm_medium: WIDGET_CAMPAIGN,
      mtm_content: 'logements',
      mtm_kwd: 'crous-paris.fr',
      mtm_source: 'crous-paris.fr',
    })
  })

  it('garde la campagne même sans partenaire identifié', () => {
    const params = buildWidgetCampaignParams({ partner: null, widget: 'calculatrice' })

    expect(params.mtm_campaign).toBe(WIDGET_CAMPAIGN)
    expect(params.mtm_kwd).toBeUndefined()
  })

  it('ne produit rien hors contexte widget', () => {
    expect(buildWidgetCampaignParams({ partner: 'crous-paris.fr', widget: null })).toEqual({})
  })
})

describe('appendWidgetCampaign', () => {
  const campaign = { partner: 'crous-paris.fr', widget: 'logements' } as const

  it('laisse le lien intact hors contexte widget', () => {
    const href = '/trouver-un-logement-etudiant/ville/Paris/residence'

    expect(appendWidgetCampaign(href, { partner: 'crous-paris.fr', widget: null })).toBe(href)
  })

  it('marque un lien relatif', () => {
    const result = new URL(appendWidgetCampaign('/trouver-un-logement-etudiant', campaign), 'https://x.fr')

    expect(result.pathname).toBe('/trouver-un-logement-etudiant')
    expect(result.searchParams.get('mtm_campaign')).toBe(WIDGET_CAMPAIGN)
    expect(result.searchParams.get('mtm_kwd')).toBe('crous-paris.fr')
  })

  it('marque un lien absolu sans toucher à son origine', () => {
    const result = new URL(appendWidgetCampaign('https://monlogementetudiant.beta.gouv.fr', campaign))

    expect(result.origin).toBe('https://monlogementetudiant.beta.gouv.fr')
    expect(result.searchParams.get('mtm_content')).toBe('logements')
  })

  it('conserve les paramètres et l’ancre déjà présents', () => {
    const result = appendWidgetCampaign('/trouver-un-logement-etudiant?ville=Lyon&prix=500#resultats', campaign)
    const parsed = new URL(result, 'https://x.fr')

    expect(parsed.searchParams.get('ville')).toBe('Lyon')
    expect(parsed.searchParams.get('prix')).toBe('500')
    expect(parsed.hash).toBe('#resultats')
    expect(parsed.searchParams.get('mtm_campaign')).toBe(WIDGET_CAMPAIGN)
  })

  it('remplace un marquage déjà posé plutôt que de le dupliquer', () => {
    const result = appendWidgetCampaign('/trouver-un-logement-etudiant?mtm_kwd=ancien-partenaire', campaign)

    expect(result.match(/mtm_kwd/g)).toHaveLength(1)
    expect(new URL(result, 'https://x.fr').searchParams.get('mtm_kwd')).toBe('crous-paris.fr')
  })
})
