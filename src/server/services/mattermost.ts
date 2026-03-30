import * as Sentry from '@sentry/nextjs'

const MATTERMOST_WEBHOOK_URL = process.env.MATTERMOST_WEBHOOK_URL

const BASE_URL = process.env.BASE_URL ?? 'https://monlogementetudiant.beta.gouv.fr'

function accommodationUrl(slug: string): string {
  return `${BASE_URL.replace(/\/$/, '')}/residences/${slug}`
}

async function sendWebhook(text: string): Promise<void> {
  if (!MATTERMOST_WEBHOOK_URL || process.env.NEXT_PUBLIC_APP_ENV !== 'production') return

  try {
    const response = await fetch(MATTERMOST_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      console.warn(`Mattermost webhook failed: ${response.status} ${await response.text()}`)
    }
  } catch (error) {
    Sentry.captureException(error, { level: 'warning', tags: { service: 'mattermost' } })
    console.warn('Mattermost webhook error:', error)
  }
}

export function notifyAccommodationCreated(name: string, ownerName: string, slug: string, userName: string): void {
  const url = accommodationUrl(slug)
  const text = `Résidence créée: [${name}](${url}) de ${ownerName} par ${userName}`
  void sendWebhook(text)
}

export function notifyAccommodationUpdated(
  name: string,
  ownerName: string,
  slug: string,
  userName: string,
  diff: Record<string, { old: unknown; new: unknown }>,
): void {
  if (Object.keys(diff).length === 0) return

  const url = accommodationUrl(slug)
  const text = `Résidence modifiée: [${name}](${url}) de ${ownerName} par ${userName}\n**Diff :**\n\`\`\`json\n${JSON.stringify(diff, null, 2)}\n\`\`\``
  void sendWebhook(text)
}
