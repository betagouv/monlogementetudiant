import { describe, expect, it } from 'vitest'
import { redirectEmail } from './redirect-email'

const DOMAIN = 'qa-mail.monlogementetudiant.beta.gouv.fr'

describe('redirectEmail', () => {
  it("encode l'adresse d'origine dans le local-part", () => {
    expect(redirectEmail('jean@gmail.com', DOMAIN)).toBe('jean.at.gmail.com@qa-mail.monlogementetudiant.beta.gouv.fr')
    expect(redirectEmail('jean.dupont+mle@univ-paris.fr', DOMAIN)).toBe(
      'jean.dupont+mle.at.univ-paris.fr@qa-mail.monlogementetudiant.beta.gouv.fr',
    )
  })

  it('remplace un local-part de plus de 64 caractères', () => {
    const email = `${'a'.repeat(60)}@example.com`
    expect(redirectEmail(email, DOMAIN)).toBe('adresse-trop-longue@qa-mail.monlogementetudiant.beta.gouv.fr')
  })

  it('accepte un local-part de 64 caractères pile', () => {
    const local = 'a'.repeat(64 - '.at.example.com'.length)
    expect(redirectEmail(`${local}@example.com`, DOMAIN)).toBe(`${local}.at.example.com@${DOMAIN}`)
  })
})
