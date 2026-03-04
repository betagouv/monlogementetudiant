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
        params: { MAGIC_LINK: 'https://example.com/magic' },
      })
    })

    it('throws when BREVO_API_KEY is not set', async () => {
      vi.stubEnv('BREVO_API_KEY', '')
      const { sendTemplateEmail } = await import('./brevo')

      await expect(sendTemplateEmail({ to: 'user@test.com', templateId: 2, params: {} })).rejects.toThrow('BREVO_API_KEY is not set')
    })

    it('throws on non-ok response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      })
      const { sendTemplateEmail } = await import('./brevo')

      await expect(sendTemplateEmail({ to: 'user@test.com', templateId: 2, params: {} })).rejects.toThrow(
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
})
