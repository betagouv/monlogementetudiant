import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CRON_COMMANDS, jobNameFromArgv } from '../cron-failure'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// L'interception hors prod (ADR 0003) est testée dans email-delivery.test.ts. Ici on vérifie le
// contrat d'envoi : on neutralise l'interception par un passthrough vers les destinataires.
vi.mock('~/server/services/email-delivery', () => ({
  resolveEmailDelivery: vi.fn(async (_category: string, recipients: string[]) => ({ action: 'send', recipients })),
}))

/**
 * Extrait le nom des commandes planifiées depuis `cron.json` : on retire l'expression cron et
 * le préfixe `npx tsx cli/index.ts`, on coupe aux options, et on gère les lignes composées
 * qui enchaînent deux commandes avec `;`.
 */
function scheduledCommands(): string[] {
  const cronConfig = JSON.parse(readFileSync(new URL('../../cron.json', import.meta.url), 'utf-8')) as {
    jobs: { command: string }[]
  }

  return cronConfig.jobs.flatMap((job) =>
    job.command.split(';').map((segment) => {
      const [, args = ''] = segment.split('cli/index.ts')
      const parts: string[] = []
      for (const arg of args.trim().split(/\s+/).filter(Boolean)) {
        if (arg.startsWith('-')) break
        parts.push(arg)
      }
      return parts.join(' ')
    }),
  )
}

describe('CRON_COMMANDS', () => {
  it('couvre toutes les commandes planifiées dans cron.json', () => {
    const missing = scheduledCommands().filter((command) => !CRON_COMMANDS.has(command))

    expect(missing, `Commandes planifiées absentes de CRON_COMMANDS : ${missing.join(', ')}`).toEqual([])
  })

  it('lit bien des commandes dans cron.json (garde-fou contre un parsing silencieusement cassé)', () => {
    expect(scheduledCommands().length).toBeGreaterThanOrEqual(10)
  })
})

describe('jobNameFromArgv', () => {
  it('reconstruit une commande simple', () => {
    expect(jobNameFromArgv(['node', 'cli/index.ts', 'send-alert-jobs'])).toBe('send-alert-jobs')
  })

  it('reconstruit une sous-commande avec son argument', () => {
    expect(jobNameFromArgv(['node', 'cli/index.ts', 'import', 'arpej-ibail'])).toBe('import arpej-ibail')
  })

  it("s'arrête à la première option, sans avaler sa valeur", () => {
    expect(jobNameFromArgv(['node', 'cli/index.ts', 'sync', 'stats', '--only', 'events'])).toBe('sync stats')
  })

  it('retourne une chaîne vide sans commande', () => {
    expect(jobNameFromArgv(['node', 'cli/index.ts'])).toBe('')
  })
})

describe('formatCronFailure', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('CONTAINER', 'one-off-8f2c')
  })

  async function format(error: unknown) {
    const { formatCronFailure } = await import('../cron-failure')
    return formatCronFailure({
      job: 'import arpej-ibail',
      error,
      startedAt: new Date('2026-08-10T00:00:03Z'),
      endedAt: new Date('2026-08-10T00:04:15Z'),
    })
  }

  it("nomme le job et l'environnement dans l'objet", async () => {
    const { subject } = await format(new Error('boom'))

    expect(subject).toBe('[MLE development] Cron en échec — import arpej-ibail')
  })

  it('rapporte le contexte du run', async () => {
    const { textContent } = await format(new Error('connect ETIMEDOUT'))

    expect(textContent).toContain('Job        : import arpej-ibail')
    expect(textContent).toContain('Env        : development')
    expect(textContent).toContain('Durée      : 4 min 12 s')
    expect(textContent).toContain('Conteneur  : one-off-8f2c')
    expect(textContent).toContain('Erreur : Error: connect ETIMEDOUT')
  })

  it('tronque la stack et signale les lignes masquées', async () => {
    const error = new Error('boom')
    error.stack = ['Error: boom', ...Array.from({ length: 40 }, (_, i) => `    at frame${i}`)].join('\n')

    const { textContent } = await format(error)

    expect(textContent).toContain('at frame14')
    expect(textContent).not.toContain('at frame15')
    expect(textContent).toContain('… 25 ligne(s) supplémentaire(s)')
  })

  it('détaille un échec partiel en tronquant au-delà de dix erreurs', async () => {
    const details = Array.from({ length: 12 }, (_, i) => `Résidence ${i} : null value`)
    // La classe doit venir de la même instance de module que `formatCronFailure`, sinon le
    // `instanceof` échoue : `vi.resetModules()` recharge le module à chaque test.
    const { CronPartialFailure } = await import('../cron-failure')

    const { textContent } = await format(new CronPartialFailure('12 erreur(s) sur des éléments', details))

    expect(textContent).toContain('Détail (12) :')
    expect(textContent).toContain('- Résidence 9 : null value')
    expect(textContent).not.toContain('- Résidence 10 : null value')
    expect(textContent).toContain('… 2 autre(s)')
  })

  it('accepte une erreur qui n’est pas une Error', async () => {
    const { textContent } = await format('échec brut')

    expect(textContent).toContain('Erreur : échec brut')
  })
})

describe('notifyCronFailure', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true })
    vi.resetModules()
  })

  async function notify() {
    const { notifyCronFailure } = await import('../cron-failure')
    await notifyCronFailure({ job: 'send-alert-jobs', error: new Error('boom'), startedAt: new Date() })
  }

  it('envoie le mail à tous les destinataires configurés', async () => {
    vi.stubEnv('CRON_FAILURE_EMAILS', 'ops@example.fr, dev@example.fr')

    await notify()

    expect(fetchMock).toHaveBeenCalledOnce()
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.to).toEqual([{ email: 'ops@example.fr' }, { email: 'dev@example.fr' }])
    expect(body.sender).toEqual({ email: 'no-reply@monlogementetudiant.beta.gouv.fr', name: 'MLE Crons' })
    expect(body.subject).toContain('send-alert-jobs')
    expect(body.templateId).toBeUndefined()
  })

  it("n'envoie rien quand la variable est vide", async () => {
    vi.stubEnv('CRON_FAILURE_EMAILS', '')

    await notify()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("n'échoue pas quand Brevo refuse l'envoi", async () => {
    vi.stubEnv('CRON_FAILURE_EMAILS', 'ops@example.fr')
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => 'sender not validated' })

    await expect(notify()).resolves.toBeUndefined()
  })

  it("n'échoue pas quand l'appel Brevo lève", async () => {
    vi.stubEnv('CRON_FAILURE_EMAILS', 'ops@example.fr')
    fetchMock.mockRejectedValue(new Error('timeout'))

    await expect(notify()).resolves.toBeUndefined()
  })
})
