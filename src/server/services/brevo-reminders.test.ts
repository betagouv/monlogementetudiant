import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })

const ev = (event: string, messageId = 'm1', email = 'a@x.fr', date = '2026-03-10T08:00:00.000Z') => ({
  date,
  email,
  event,
  messageId,
  templateId: 5,
})

const urlOf = (call: unknown[]) => new URL(call[0] as string)
const dayDiff = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000

describe('brevo-reminders', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.resetModules()
    vi.stubEnv('BREVO_API_KEY', 'test-api-key')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-09'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('summarizeEvents', () => {
    it('retient le statut le plus avancé : clicked', async () => {
      const { summarizeEvents } = await import('./brevo-reminders')
      const result = summarizeEvents([ev('requests'), ev('delivered'), ev('opened'), ev('clicks')])
      expect(result).toEqual([
        { messageId: 'm1', email: 'a@x.fr', templateId: 5, sentAt: new Date('2026-03-10T08:00:00.000Z'), status: 'clicked' },
      ])
    })

    it('un hard bounce est prioritaire', async () => {
      const { summarizeEvents } = await import('./brevo-reminders')
      const result = summarizeEvents([ev('requests'), ev('delivered'), ev('hardBounces')])
      expect(result[0].status).toBe('bounced')
    })

    it('ignore les messages sans événement requests', async () => {
      const { summarizeEvents } = await import('./brevo-reminders')
      expect(summarizeEvents([ev('delivered'), ev('opened')])).toEqual([])
    })

    it('met l’email en minuscules', async () => {
      const { summarizeEvents } = await import('./brevo-reminders')
      expect(summarizeEvents([ev('requests', 'm1', 'Jean@X.fr')])[0].email).toBe('jean@x.fr')
    })

    it('gère deferred, softBounces, blocked, error et les événements neutres', async () => {
      const { summarizeEvents } = await import('./brevo-reminders')
      expect(summarizeEvents([ev('requests')])[0].status).toBe('sent')
      expect(summarizeEvents([ev('requests'), ev('softBounces')])[0].status).toBe('deferred')
      expect(summarizeEvents([ev('requests'), ev('deferred'), ev('delivered')])[0].status).toBe('delivered')
      expect(summarizeEvents([ev('requests'), ev('delivered'), ev('blocked')])[0].status).toBe('blocked')
      expect(summarizeEvents([ev('requests'), ev('error'), ev('opened')])[0].status).toBe('error')
      expect(summarizeEvents([ev('requests'), ev('invalid')])[0].status).toBe('bounced')
      expect(summarizeEvents([ev('requests'), ev('loadedByProxy'), ev('spam'), ev('unsubscribed')])[0].status).toBe('sent')
    })
  })

  describe('fetchReminderMessages', () => {
    it('découpe une plage de 200 jours en tranches de 90 jours au plus', async () => {
      fetchMock.mockResolvedValue(ok({}))
      const { fetchReminderMessages } = await import('./brevo-reminders')

      await fetchReminderMessages({ templateIds: [5], from: '2026-01-01', to: '2026-07-19' })

      const ranges = fetchMock.mock.calls.map((c) => ({
        start: urlOf(c).searchParams.get('startDate') as string,
        end: urlOf(c).searchParams.get('endDate') as string,
      }))
      expect(ranges.length).toBeGreaterThan(1)
      expect(ranges[0].start).toBe('2026-01-01')
      for (const r of ranges) expect(dayDiff(r.start, r.end)).toBeLessThanOrEqual(89)
      for (let i = 1; i < ranges.length; i++) expect(dayDiff(ranges[i - 1].end, ranges[i].start)).toBe(1)
      expect(ranges[ranges.length - 1].end).toBe('2026-08-19')
    })

    it('plafonne la fin à aujourd’hui', async () => {
      fetchMock.mockResolvedValue(ok({}))
      const { fetchReminderMessages } = await import('./brevo-reminders')

      await fetchReminderMessages({ templateIds: [5], from: '2026-11-01', to: '2026-11-08' })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(urlOf(fetchMock.mock.calls[0]).searchParams.get('endDate')).toBe('2026-11-09')
    })

    it('envoie la clé API, templateId et limit', async () => {
      fetchMock.mockResolvedValue(ok({}))
      const { fetchReminderMessages } = await import('./brevo-reminders')

      await fetchReminderMessages({ templateIds: [5, 6], from: '2026-03-01', to: '2026-03-31' })

      expect(fetchMock).toHaveBeenCalledTimes(2)
      const url = urlOf(fetchMock.mock.calls[0])
      expect(url.origin + url.pathname).toBe('https://api.brevo.com/v3/smtp/statistics/events')
      expect(url.searchParams.get('templateId')).toBe('5')
      expect(url.searchParams.get('limit')).toBe('2500')
      expect(fetchMock.mock.calls[0][1].headers['api-key']).toBe('test-api-key')
      expect(urlOf(fetchMock.mock.calls[1]).searchParams.get('templateId')).toBe('6')
    })

    it('pagine tant que la page est pleine', async () => {
      const full = Array.from({ length: 2500 }, (_, i) => ev('requests', `m${i}`))
      const rest = [ev('requests', 'z1'), ev('requests', 'z2'), ev('requests', 'z3')]
      fetchMock.mockResolvedValueOnce(ok({ events: full })).mockResolvedValueOnce(ok({ events: rest }))
      const { fetchReminderMessages } = await import('./brevo-reminders')

      const result = await fetchReminderMessages({ templateIds: [5], from: '2026-03-01', to: '2026-03-31' })

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(urlOf(fetchMock.mock.calls[0]).searchParams.get('offset')).toBe('0')
      expect(urlOf(fetchMock.mock.calls[1]).searchParams.get('offset')).toBe('2500')
      expect(result).toHaveLength(2503)
    })

    it('filtre sentAt sur [from, to] (bornes inclusives)', async () => {
      fetchMock.mockResolvedValue(
        ok({
          events: [
            ev('requests', 'a', 'a@x.fr', '2026-02-28T23:00:00.000Z'),
            ev('requests', 'b', 'b@x.fr', '2026-03-01T00:00:00.000Z'),
            ev('requests', 'c', 'c@x.fr', '2026-03-31T23:59:00.000Z'),
            ev('requests', 'd', 'd@x.fr', '2026-04-01T00:00:00.000Z'),
          ],
        }),
      )
      const { fetchReminderMessages } = await import('./brevo-reminders')

      const result = await fetchReminderMessages({ templateIds: [5], from: '2026-03-01', to: '2026-03-31' })

      expect(result.map((m) => m.messageId)).toEqual(['b', 'c'])
    })

    it('lève une erreur si Brevo répond 401', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })
      const { fetchReminderMessages } = await import('./brevo-reminders')

      await expect(fetchReminderMessages({ templateIds: [5], from: '2026-03-01', to: '2026-03-31' })).rejects.toThrow('401')
    })

    it('lève une erreur si la réponse est invalide', async () => {
      fetchMock.mockResolvedValue(ok({ events: [{ foo: 'bar' }] }))
      const { fetchReminderMessages } = await import('./brevo-reminders')

      await expect(fetchReminderMessages({ templateIds: [5], from: '2026-03-01', to: '2026-03-31' })).rejects.toThrow(
        'Réponse Brevo invalide',
      )
    })
  })

  describe('fetchBlockedContacts', () => {
    const contact = (i: number, reason: string | undefined = 'hardBounce') => ({
      email: `User${i}@X.fr`,
      blockedAt: '2026-05-01T10:00:00.000Z',
      senderEmail: null,
      reason: { code: reason, message: 'm' },
    })

    it('lit toutes les pages', async () => {
      fetchMock
        .mockResolvedValueOnce(ok({ contacts: Array.from({ length: 100 }, (_, i) => contact(i)) }))
        .mockResolvedValueOnce(ok({ contacts: Array.from({ length: 20 }, (_, i) => contact(100 + i)) }))
      const { fetchBlockedContacts } = await import('./brevo-reminders')

      const result = await fetchBlockedContacts()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(urlOf(fetchMock.mock.calls[1]).searchParams.get('offset')).toBe('100')
      expect(urlOf(fetchMock.mock.calls[0]).searchParams.get('limit')).toBe('100')
      expect(result).toHaveLength(120)
      expect(result[0]).toEqual({ email: 'user0@x.fr', blockedAt: new Date('2026-05-01T10:00:00.000Z'), reason: 'hardBounce' })
    })

    it('mappe une raison inconnue ou absente vers null', async () => {
      fetchMock.mockResolvedValueOnce(ok({ contacts: [contact(1, 'weird'), { ...contact(2), reason: {} }] }))
      const { fetchBlockedContacts } = await import('./brevo-reminders')

      const result = await fetchBlockedContacts()

      expect(result.map((c) => c.reason)).toEqual([null, null])
    })

    it('lève une erreur si Brevo répond 401', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })
      const { fetchBlockedContacts } = await import('./brevo-reminders')

      await expect(fetchBlockedContacts()).rejects.toThrow('401')
    })
  })
})
