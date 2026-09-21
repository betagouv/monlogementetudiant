import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

describe('brevo service', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true })
    vi.resetModules()
    vi.stubEnv('BREVO_API_KEY', 'test-api-key')
    vi.stubEnv('BREVO_TEMPLATE_MAGIC_LINK', '2')
    vi.stubEnv('BREVO_TEMPLATE_VALIDATION', '21')
    vi.stubEnv('BREVO_TEMPLATE_RESET_PASSWORD', '23')
    vi.stubEnv('BREVO_TEMPLATE_OWNER_WELCOME', '40')
    vi.stubEnv('BREVO_TEMPLATE_ALERT_CREATION', '43')
  })

  describe('sendTemplateEmail', () => {
    it('sends request with templateId and params', async () => {
      const { sendTemplateEmail } = await import('./brevo')

      await sendTemplateEmail({
        to: 'user@test.com',
        templateId: 2,
        params: { MAGIC_LINK: 'https://example.com/magic' },
      })

      expect(fetchMock).toHaveBeenCalledOnce()
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.brevo.com/v3/smtp/email')
      expect(options.method).toBe('POST')
      expect(options.headers['api-key']).toBe('test-api-key')

      const body = JSON.parse(options.body)
      expect(body).toEqual({
        to: [{ email: 'user@test.com' }],
        templateId: 2,
        replyTo: { email: 'no-reply@monlogementetudiant.beta.gouv.fr' },
        params: { MAGIC_LINK: 'https://example.com/magic' },
      })
    })

    it('throws when BREVO_API_KEY is not set', async () => {
      vi.stubEnv('BREVO_API_KEY', '')

      await expect(import('./brevo')).rejects.toThrow('BREVO_API_KEY is required')
    })

    it('omits params from body when empty', async () => {
      const { sendTemplateEmail } = await import('./brevo')

      await sendTemplateEmail({ to: 'user@test.com', templateId: 40 })

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body).toEqual({
        to: [{ email: 'user@test.com' }],
        templateId: 40,
        replyTo: { email: 'no-reply@monlogementetudiant.beta.gouv.fr' },
      })
      expect(body.params).toBeUndefined()
    })

    it('throws on non-ok response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      })
      const { sendTemplateEmail } = await import('./brevo')

      await expect(sendTemplateEmail({ to: 'user@test.com', templateId: 2, params: { X: 'y' } })).rejects.toThrow(
        'Brevo email failed: 400 Bad Request',
      )
    })
  })

  describe('sendMagicLinkEmail', () => {
    it('uses template ID 2 with MAGIC_LINK param', async () => {
      const { sendMagicLinkEmail } = await import('./brevo')

      await sendMagicLinkEmail('user@test.com', 'https://example.com/magic')

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.templateId).toBe(2)
      expect(body.params).toEqual({ MAGIC_LINK: 'https://example.com/magic' })
      expect(body.to).toEqual([{ email: 'user@test.com' }])
    })
  })

  describe('sendVerificationEmail', () => {
    it('uses template ID 21 with VALIDATION_LINK param', async () => {
      const { sendVerificationEmail } = await import('./brevo')

      await sendVerificationEmail('user@test.com', 'https://example.com/verify')

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.templateId).toBe(21)
      expect(body.params).toEqual({ VALIDATION_LINK: 'https://example.com/verify' })
      expect(body.to).toEqual([{ email: 'user@test.com' }])
    })
  })

  describe('sendResetPasswordEmail', () => {
    it('uses template ID 23 with RESET_LINK param', async () => {
      const { sendResetPasswordEmail } = await import('./brevo')

      await sendResetPasswordEmail('user@test.com', 'https://example.com/reset')

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.templateId).toBe(23)
      expect(body.params).toEqual({ RESET_LINK: 'https://example.com/reset' })
      expect(body.to).toEqual([{ email: 'user@test.com' }])
    })
  })

  describe('sendOwnerWelcomeEmail', () => {
    it('uses template ID 40 without params', async () => {
      const { sendOwnerWelcomeEmail } = await import('./brevo')

      await sendOwnerWelcomeEmail('owner@test.com', { firstname: 'Jean', lastname: 'Dupont' })

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body).toEqual({
        to: [{ email: 'owner@test.com' }],
        templateId: 40,
        replyTo: { email: 'no-reply@monlogementetudiant.beta.gouv.fr' },
      })
      expect(body.params).toBeUndefined()
    })
  })

  describe('sendAdminResetPasswordEmail', () => {
    it('uses template ID 50 without params', async () => {
      vi.stubEnv('BREVO_TEMPLATE_ADMIN_RESET_PASSWORD', '50')
      const { sendAdminResetPasswordEmail } = await import('./brevo')

      await sendAdminResetPasswordEmail('student@test.com')

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body).toEqual({
        to: [{ email: 'student@test.com' }],
        templateId: 50,
        replyTo: { email: 'no-reply@monlogementetudiant.beta.gouv.fr' },
      })
      expect(body.params).toBeUndefined()
    })
  })

  describe('sendApplicationsManagementGrantedEmail', () => {
    it('envoie le template dédié avec les résidences attribuées', async () => {
      vi.stubEnv('BREVO_TEMPLATE_APPLICATIONS_MANAGEMENT_GRANTED', '59')
      const { sendApplicationsManagementGrantedEmail } = await import('./brevo')

      await sendApplicationsManagementGrantedEmail('gest@test.com', {
        firstname: 'Jean',
        ownerName: 'Crous Paris',
        residences: ['Res A', 'Res B'],
        residencesCount: 2,
        url: 'https://example.com/bailleur/contacts',
      })

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body).toEqual({
        to: [{ email: 'gest@test.com' }],
        templateId: 59,
        replyTo: { email: 'no-reply@monlogementetudiant.beta.gouv.fr' },
        params: {
          FIRSTNAME: 'Jean',
          OWNER_NAME: 'Crous Paris',
          RESIDENCES: ['Res A', 'Res B'],
          RESIDENCES_COUNT: '2',
          LINK: 'https://example.com/bailleur/contacts',
        },
      })
    })
  })

  describe('sendApplicationsSuspendedEmail', () => {
    it('envoie le template dédié avec la résidence et son auteur', async () => {
      vi.stubEnv('BREVO_TEMPLATE_APPLICATIONS_SUSPENDED', '60')
      const { sendApplicationsSuspendedEmail } = await import('./brevo')

      await sendApplicationsSuspendedEmail('admin@test.com', {
        firstname: 'Alice',
        residenceName: 'Res A',
        suspendedBy: 'Jean Dupont',
        ownerName: 'Crous Paris',
        suspendedAt: '21 septembre 2026 à 10:00',
        url: 'https://example.com/bailleur/contacts/res-a',
      })

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.templateId).toBe(60)
      expect(body.params).toEqual({
        FIRSTNAME: 'Alice',
        RESIDENCE_NAME: 'Res A',
        SUSPENDED_BY: 'Jean Dupont',
        OWNER_NAME: 'Crous Paris',
        SUSPENDED_AT: '21 septembre 2026 à 10:00',
        LINK: 'https://example.com/bailleur/contacts/res-a',
      })
    })
  })

  describe('sendAlertCreationConfirmationEmail', () => {
    it('uses template ID 43 avec alertName, maxBudget et les valeurs par défaut pour city et academy', async () => {
      const { sendAlertCreationConfirmationEmail } = await import('./brevo')

      await sendAlertCreationConfirmationEmail('student@test.com', {
        alertName: 'Mon alerte Paris',
        maxBudget: 600,
      })

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.templateId).toBe(43)
      expect(body.to).toEqual([{ email: 'student@test.com' }])
      expect(body.params.alertName).toBe('Mon alerte Paris')
      expect(body.params.maxBudget).toBe('600')
      expect(body.params.city).toBe('Non définie')
      expect(body.params.academy).toBe('Non définie')
    })

    it('inclut la valeur de city quand elle est fournie', async () => {
      const { sendAlertCreationConfirmationEmail } = await import('./brevo')

      await sendAlertCreationConfirmationEmail('student@test.com', {
        alertName: 'Mon alerte',
        city: 'Lyon',
        maxBudget: 500,
      })

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.params.city).toBe('Lyon')
      expect(body.params.academy).toBe('Non définie')
    })

    it('inclut la valeur de academy quand elle est fournie', async () => {
      const { sendAlertCreationConfirmationEmail } = await import('./brevo')

      await sendAlertCreationConfirmationEmail('student@test.com', {
        alertName: 'Mon alerte',
        academy: 'Académie de Bordeaux',
        maxBudget: 450,
      })

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.params.academy).toBe('Académie de Bordeaux')
      expect(body.params.city).toBe('Non définie')
    })

    it("ne propage pas l'erreur si l'envoi échoue", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Internal Server Error' })
      const { sendAlertCreationConfirmationEmail } = await import('./brevo')

      await expect(
        sendAlertCreationConfirmationEmail('student@test.com', { alertName: 'Mon alerte', maxBudget: 500 }),
      ).resolves.toBeUndefined()
    })
  })

  describe('syncBrevoOwnerCreated', () => {
    it('sends COMPTE_ESPACE_GESTIONNAIRE and DATE_CREATION_COMPTE_ESPACE_GESTIONNAIRE attributes when contacts URL is set', async () => {
      vi.stubEnv('BREVO_CONTACTS_API_URL', 'https://api.brevo.com/v3/contacts')
      const { syncBrevoOwnerCreated } = await import('./brevo')

      await syncBrevoOwnerCreated('owner@test.com', { firstname: 'Jean', lastname: 'Dupont' })

      expect(fetchMock).toHaveBeenCalledOnce()
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.brevo.com/v3/contacts')
      expect(options.method).toBe('POST')

      const body = JSON.parse(options.body)
      expect(body.email).toEqual('owner@test.com')
      expect(body.attributes.COMPTE_ESPACE_GESTIONNAIRE).toEqual(true)
      expect(body.attributes.DATE_CREATION_COMPTE_ESPACE_GESTIONNAIRE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(body.attributes.NOM).toEqual('Dupont')
      expect(body.attributes.PRENOM).toEqual('Jean')
      expect(body.updateEnabled).toEqual(true)
    })

    it('uses the provided createdAt for DATE_CREATION_COMPTE_ESPACE_GESTIONNAIRE when given', async () => {
      vi.stubEnv('BREVO_CONTACTS_API_URL', 'https://api.brevo.com/v3/contacts')
      const { syncBrevoOwnerCreated } = await import('./brevo')

      await syncBrevoOwnerCreated('owner@test.com', {
        firstname: 'Jean',
        lastname: 'Dupont',
        createdAt: new Date('2021-03-15T10:30:00.000Z'),
      })

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.attributes.DATE_CREATION_COMPTE_ESPACE_GESTIONNAIRE).toBe('2021-03-15')
    })
  })

  describe('syncBrevoStudentCreated', () => {
    it('sends COMPTE_ESPACE_GESTIONNAIRE false with an empty DATE_CREATION_COMPTE_ESPACE_GESTIONNAIRE', async () => {
      vi.stubEnv('BREVO_CONTACTS_API_URL', 'https://api.brevo.com/v3/contacts')
      const { syncBrevoStudentCreated } = await import('./brevo')

      await syncBrevoStudentCreated('student@test.com', { firstname: 'Marie', lastname: 'Martin' })

      expect(fetchMock).toHaveBeenCalledOnce()
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.brevo.com/v3/contacts')

      const body = JSON.parse(options.body)
      expect(body.email).toEqual('student@test.com')
      expect(body.attributes.COMPTE_ESPACE_GESTIONNAIRE).toEqual(false)
      expect(body.attributes.DATE_CREATION_COMPTE_ESPACE_GESTIONNAIRE).toEqual('')
      expect(body.attributes.NOM).toEqual('Martin')
      expect(body.attributes.PRENOM).toEqual('Marie')
      expect(body.updateEnabled).toEqual(true)
    })
  })

  describe('syncBrevoDataUpdated', () => {
    it('sends DATE_DERNIERE_MAJ_DONNEES attribute when contacts URL is set', async () => {
      vi.stubEnv('BREVO_CONTACTS_API_URL', 'https://api.brevo.com/v3/contacts')
      const { syncBrevoDataUpdated } = await import('./brevo')

      await syncBrevoDataUpdated('owner@test.com')

      expect(fetchMock).toHaveBeenCalledOnce()
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.brevo.com/v3/contacts')

      const body = JSON.parse(options.body)
      expect(body.email).toBe('owner@test.com')
      expect(body.attributes.DATE_DERNIERE_MAJ_DONNEES).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(body.updateEnabled).toBe(true)
    })
  })
})
