import { z } from 'zod'

const ZTokenExchange = z.object({ token: z.string() })
const ZOneOff = z.object({ container: z.object({ id: z.string() }) })

async function parseScalingoJson<T>(response: Response, schema: z.ZodType<T>, context: string): Promise<T> {
  const result = schema.safeParse(await response.json())
  if (!result.success) throw new Error(`Réponse Scalingo inattendue (${context}) : ${result.error.message}`)
  return result.data
}

export async function exchangeScalingoToken(apiToken: string): Promise<string> {
  const response = await fetch('https://auth.scalingo.com/v1/tokens/exchange', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`:${apiToken}`).toString('base64')}` },
  })
  if (!response.ok) throw new Error(`Token exchange failed: ${response.status} ${await response.text()}`)
  const { token } = await parseScalingoJson(response, ZTokenExchange, 'tokens/exchange')
  return token
}

type TRunDetachedOneOff = {
  apiToken: string
  region: string
  app: string
  command: string
  env: Record<string, string>
  size?: string
}

export async function runDetachedOneOff({ apiToken, region, app, command, env, size = 'M' }: TRunDetachedOneOff) {
  const bearer = await exchangeScalingoToken(apiToken)
  const response = await fetch(`https://api.${region}.scalingo.com/v1/apps/${app}/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ command, env, size, detached: true }),
  })
  if (!response.ok) throw new Error(`Lancement du one-off Scalingo refusé : ${response.status} ${await response.text()}`)
  const { container } = await parseScalingoJson(response, ZOneOff, 'apps/run')
  return { containerId: container.id }
}
