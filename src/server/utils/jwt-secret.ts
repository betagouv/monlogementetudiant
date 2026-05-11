import { env } from '~/server/env'

export function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(env.AUTH_SECRET)
}
