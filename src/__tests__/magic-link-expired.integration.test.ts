import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createUser } from './fixtures/factories'
import './helpers/setup-integration'

vi.mock('next/headers', () => ({ headers: () => new Headers() }))

const sentEmails = vi.hoisted(() => [] as { email: string; url: string }[])

vi.mock('~/server/services/brevo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/server/services/brevo')>()),
  sendMagicLinkEmail: vi.fn(async (email: string, url: string) => {
    sentEmails.push({ email, url })
  }),
}))

import { GET } from '~/app/api/auth/[...all]/route'
import { sendMagicLink } from '~/components/magic-link-sign-in/actions'

/** Extrait l'URL de vérification Better Auth encapsulée dans la page tampon envoyée par email. */
const verifyUrlFromEmail = (bufferUrl: string) => new URL(bufferUrl).searchParams.get('url')

beforeEach(() => {
  sentEmails.length = 0
})

describe('lien de connexion expiré', () => {
  it('place une errorCallbackURL dans le lien envoyé au gestionnaire', async () => {
    await createUser({ id: 'gest-expire', name: 'Gestionnaire', email: 'gest-expire@bailleur.fr', role: 'owner' })

    await sendMagicLink('gest-expire@bailleur.fr', 'owner', '/bailleur/tableau-de-bord')

    expect(sentEmails).toHaveLength(1)
    const verifyUrl = verifyUrlFromEmail(sentEmails[0].url)
    expect(verifyUrl).not.toBeNull()
    expect(new URL(verifyUrl!).searchParams.get('errorCallbackURL')).toBe('/verification/erreur?role=owner')
  })

  it("renvoie vers la page d'erreur, et non vers le tableau de bord qui rendrait un 404", async () => {
    await createUser({ id: 'gest-404', name: 'Gestionnaire', email: 'gest-404@bailleur.fr', role: 'owner' })

    await sendMagicLink('gest-404@bailleur.fr', 'owner', '/bailleur/tableau-de-bord')
    const verifyUrl = new URL(verifyUrlFromEmail(sentEmails[0].url)!)
    // Un jeton inconnu produit la même issue qu'un jeton périmé ou déjà consommé : Better Auth
    // purge la ligne de `verification` dès la première ouverture.
    verifyUrl.searchParams.set('token', 'jeton-perime')

    const response = await GET(new Request(verifyUrl.toString()))

    expect(response.status).toBe(302)
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/verification/erreur')
    expect(location.searchParams.get('role')).toBe('owner')
    expect(location.searchParams.get('error')).toBe('INVALID_TOKEN')
  })

  it("ramène l'administrateur vers le formulaire d'administration", async () => {
    await createUser({ id: 'admin-expire', name: 'Admin', email: 'admin-expire@mle.fr', role: 'admin' })

    await sendMagicLink('admin-expire@mle.fr', 'admin', '/administration/tableau-de-bord')
    const verifyUrl = new URL(verifyUrlFromEmail(sentEmails[0].url)!)
    verifyUrl.searchParams.set('token', 'jeton-perime')

    const response = await GET(new Request(verifyUrl.toString()))

    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/verification/erreur')
    expect(location.searchParams.get('role')).toBe('admin')
  })
})
