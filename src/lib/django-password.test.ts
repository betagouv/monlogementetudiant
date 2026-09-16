import { pbkdf2Sync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyDjangoPassword } from './django-password'

const makeDjangoHash = (password: string, iterations = 1000, salt = 'testsalt') =>
  `pbkdf2_sha256$${iterations}$${salt}$${pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64')}`

describe('verifyDjangoPassword', () => {
  it('accepte le bon mot de passe et refuse un mauvais', async () => {
    const hash = makeDjangoHash('motDePasse123!')
    await expect(verifyDjangoPassword('motDePasse123!', hash)).resolves.toBe(true)
    await expect(verifyDjangoPassword('mauvais', hash)).resolves.toBe(false)
  })

  it('refuse un hash malformé ou vide sans lever', async () => {
    await expect(verifyDjangoPassword('x', '')).resolves.toBe(false)
    await expect(verifyDjangoPassword('x', 'pbkdf2_sha256$1000$sel$')).resolves.toBe(false)
    await expect(verifyDjangoPassword('x', 'pbkdf2_sha256$abc$sel$aGFzaA==')).resolves.toBe(false)
    await expect(verifyDjangoPassword('x', 'pbkdf2_sha256$0$sel$aGFzaA==')).resolves.toBe(false)
    await expect(verifyDjangoPassword('x', 'md5$1000$sel$aGFzaA==')).resolves.toBe(false)
  })

  it('refuse un nombre d’itérations démesuré sans lancer le calcul', async () => {
    const start = Date.now()
    await expect(verifyDjangoPassword('x', 'pbkdf2_sha256$999999999$sel$aGFzaA==')).resolves.toBe(false)
    expect(Date.now() - start).toBeLessThan(100)
  })

  it('ne bloque pas la boucle d’événements pendant le calcul', async () => {
    const hash = makeDjangoHash('motDePasse123!', 200_000)
    let ticked = false
    setTimeout(() => {
      ticked = true
    }, 0)

    const verification = verifyDjangoPassword('motDePasse123!', hash)
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(ticked).toBe(true)
    await expect(verification).resolves.toBe(true)
  })
})
