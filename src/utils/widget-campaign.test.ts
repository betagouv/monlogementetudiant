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

  it.each([
    '/trouver-un-logement-etudiant',
    '/trouver-un-logement-etudiant/ville/Paris/residence',
    '/preparer-mon-budget-etudiant',
    '/simuler-mes-aides-au-logement',
    '/simuler-budget',
    '/bailleur/tableau-de-bord',
    '/widget/inconnu',
    '/widgetize',
  ])('ne reconnaît rien sur %s', (pathname) => {
    expect(getWidgetNameFromPathname(pathname)).toBeNull()
  })

  it('ne reconnaît rien sans chemin', () => {
    expect(getWidgetNameFromPathname(null)).toBeNull()
    expect(getWidgetNameFromPathname(undefined)).toBeNull()
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

  /**
   * Valeur rendue par le contexte quand aucun `WidgetCampaignProvider` n'est monté — c'est-à-dire
   * partout hors des pages widget. Les composants de carte et de simulateur étant partagés avec le
   * site principal, cet invariant est ce qui garantit qu'une URL du site ne se retrouve jamais
   * décorée de paramètres de campagne.
   */
  const OUTSIDE_WIDGET = { partner: null, widget: null } as const

  it.each([
    '/trouver-un-logement-etudiant',
    '/trouver-un-logement-etudiant/ville/Paris/residence-du-parc',
    '/trouver-un-logement-etudiant?ville=Lyon&prix=500',
    '/preparer-mon-budget-etudiant',
    '/simuler-mes-aides-au-logement#resultats',
    'https://monlogementetudiant.beta.gouv.fr',
  ])('laisse %s strictement inchangé hors contexte widget', (href) => {
    expect(appendWidgetCampaign(href, OUTSIDE_WIDGET)).toBe(href)
  })

  it('laisse le lien intact même si un partenaire est connu mais qu’on n’est pas dans un widget', () => {
    const href = '/trouver-un-logement-etudiant/ville/Paris/residence'

    expect(appendWidgetCampaign(href, { partner: 'crous-paris.fr', widget: null })).toBe(href)
  })

  it('n’ajoute pas de point d’interrogation orphelin à un lien sans paramètre', () => {
    expect(appendWidgetCampaign('/preparer-mon-budget-etudiant', OUTSIDE_WIDGET)).not.toContain('?')
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
