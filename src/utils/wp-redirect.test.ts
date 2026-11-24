import { describe, expect, it } from 'vitest'
import { buildWpPath, redirectToWp, wpCityUrl, wpUrl } from './wp-redirect'

describe('buildWpPath', () => {
  it('construit le chemin WordPress à partir de slugs', () => {
    expect(buildWpPath('/preparer-sa-vie-etudiante', ['aix-en-provence'])).toBe('/preparer-sa-vie-etudiante/aix-en-provence/')
  })

  it('normalise les noms de ville envoyés par l’autocomplétion', () => {
    expect(buildWpPath('/preparer-sa-vie-etudiante', ['Nîmes'])).toBe('/preparer-sa-vie-etudiante/nimes/')
    expect(buildWpPath('/preparer-sa-vie-etudiante', ['Le Mans'])).toBe('/preparer-sa-vie-etudiante/le-mans/')
  })

  it('refuse toute remontée d’arborescence ou caractère hors slug', () => {
    expect(buildWpPath('/preparer-sa-vie-etudiante', ['..', 'wp-json'])).toBeNull()
    expect(buildWpPath('/preparer-sa-vie-etudiante', ['../wp-json'])).toBeNull()
    expect(buildWpPath('/preparer-sa-vie-etudiante', ['paris?rest_route=/'])).toBeNull()
    expect(buildWpPath('/partenariat', ['wp-login.php'])).toBeNull()
    expect(buildWpPath('/partenariat', [''])).toBeNull()
  })
})

describe('redirectToWp', () => {
  it('redirige temporairement vers la page WordPress en conservant la query', () => {
    const response = redirectToWp(new Request('https://app.test/foire-aux-questions?paged=2'), '/foire-aux-questions/')

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://info.monlogementetudiant.beta.gouv.fr/foire-aux-questions/?paged=2')
  })

  it('reste sur l’origine WordPress quel que soit le chemin', () => {
    const response = redirectToWp(new Request('https://app.test/preparer-sa-vie-etudiante'), '')

    expect(response.headers.get('location')).toBe('https://info.monlogementetudiant.beta.gouv.fr/')
  })
})

describe('wpUrl', () => {
  it('construit l’URL absolue d’une page WordPress', () => {
    expect(wpUrl('/foire-aux-questions/')).toBe('https://info.monlogementetudiant.beta.gouv.fr/foire-aux-questions/')
  })
})

describe('wpCityUrl', () => {
  it('pointe vers la page de la ville, nom brut normalisé', () => {
    expect(wpCityUrl('Le Mans')).toBe('https://info.monlogementetudiant.beta.gouv.fr/preparer-sa-vie-etudiante/le-mans/')
  })

  it('retombe sur la racine si le nom ne donne pas de slug', () => {
    expect(wpCityUrl("L'Haÿ-les-Roses")).toBe('https://info.monlogementetudiant.beta.gouv.fr/')
  })
})
