import { describe, expect, it } from 'vitest'
import { sanitizeHTML } from './sanitize-html'

// Ces tests tournent dans l'environnement node de Vitest (pas de `window`), soit exactement les
// conditions du rendu serveur de Next : c'est là que `dompurify` nu échouait avec
// « DOMPurify.sanitize is not a function » et faisait tomber la page en 500.
describe('sanitizeHTML', () => {
  it('sanitise sans window (conditions du SSR)', () => {
    expect(typeof window).toBe('undefined')
    expect(sanitizeHTML('<p>Un <strong>studio</strong> lumineux</p>')).toBe('<p>Un <strong>studio</strong> lumineux</p>')
  })

  it('retire le HTML dangereux côté serveur au lieu de le laisser passer', () => {
    expect(sanitizeHTML('<p>Bonjour</p><script>alert(1)</script>')).toBe('<p>Bonjour</p>')
    expect(sanitizeHTML('<img src=x onerror="alert(1)">')).toBe('')
    expect(sanitizeHTML('<p onclick="alert(1)">Texte</p>')).toBe('<p>Texte</p>')
  })

  it('conserve les balises et attributs autorisés', () => {
    expect(sanitizeHTML('<a href="https://example.org" target="_blank" rel="noopener noreferrer">Lien</a>')).toBe(
      '<a href="https://example.org" target="_blank" rel="noopener noreferrer">Lien</a>',
    )
    expect(sanitizeHTML('<ul><li>Un</li><li>Deux</li></ul>')).toBe('<ul><li>Un</li><li>Deux</li></ul>')
  })

  it('force rel="noopener noreferrer" sur un lien ouvert dans un nouvel onglet', () => {
    expect(sanitizeHTML('<a href="https://example.org" target="_blank">Lien</a>')).toBe(
      '<a href="https://example.org" target="_blank" rel="noopener noreferrer">Lien</a>',
    )
    expect(sanitizeHTML('<a href="https://example.org" target="_blank" rel="opener">Lien</a>')).toBe(
      '<a href="https://example.org" target="_blank" rel="noopener noreferrer">Lien</a>',
    )
  })

  it('ne touche pas un lien sans target', () => {
    expect(sanitizeHTML('<a href="https://example.org">Lien</a>')).toBe('<a href="https://example.org">Lien</a>')
  })
})
