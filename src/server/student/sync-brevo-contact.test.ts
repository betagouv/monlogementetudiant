import { beforeEach, describe, expect, it, vi } from 'vitest'

const { syncBrevoStudentCreated, envMock } = vi.hoisted(() => ({
  syncBrevoStudentCreated: vi.fn(),
  envMock: { NEXT_PUBLIC_APP_ENV: 'production' },
}))
vi.mock('~/server/services/brevo', () => ({ syncBrevoStudentCreated }))
vi.mock('~/server/env', () => ({ env: envMock }))

import { syncStudentBrevoContactOnSignup } from './sync-brevo-contact'

const student = { email: 'etudiant@test.fr', role: 'user', firstname: 'Jean', lastname: 'Dupont' }

describe('syncStudentBrevoContactOnSignup', () => {
  beforeEach(() => {
    syncBrevoStudentCreated.mockReset()
    envMock.NEXT_PUBLIC_APP_ENV = 'production'
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('pousse le contact Brevo pour un étudiant en production', async () => {
    await syncStudentBrevoContactOnSignup(student)

    expect(syncBrevoStudentCreated).toHaveBeenCalledWith('etudiant@test.fr', { firstname: 'Jean', lastname: 'Dupont' })
  })

  it('ignore les rôles non étudiants', async () => {
    await syncStudentBrevoContactOnSignup({ ...student, role: 'owner' })
    await syncStudentBrevoContactOnSignup({ ...student, role: undefined })

    expect(syncBrevoStudentCreated).not.toHaveBeenCalled()
  })

  it('ne synchronise pas hors production', async () => {
    envMock.NEXT_PUBLIC_APP_ENV = 'staging'
    await syncStudentBrevoContactOnSignup(student)

    envMock.NEXT_PUBLIC_APP_ENV = 'development'
    await syncStudentBrevoContactOnSignup(student)

    expect(syncBrevoStudentCreated).not.toHaveBeenCalled()
  })

  it('remplace un prénom/nom absent par une chaîne vide', async () => {
    await syncStudentBrevoContactOnSignup({ email: 'sans-nom@test.fr', role: 'user' })

    expect(syncBrevoStudentCreated).toHaveBeenCalledWith('sans-nom@test.fr', { firstname: '', lastname: '' })
  })

  it("avale les erreurs Brevo sans bloquer l'inscription", async () => {
    syncBrevoStudentCreated.mockRejectedValueOnce(new Error('Brevo down'))

    await expect(syncStudentBrevoContactOnSignup(student)).resolves.toBeUndefined()
  })
})
