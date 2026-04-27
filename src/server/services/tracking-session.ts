import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'

const TRACKING_SID_COOKIE = 'jde_tsid'
const TRACKING_SID_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

/**
 * Returns the anonymous tracking session id stored in an httpOnly cookie.
 * Creates one on the fly if absent. The id is opaque (32 random bytes) and is
 * only used for server-side dedup of tracking events.
 */
export async function getOrCreateTrackingSessionId(): Promise<string> {
  const store = await cookies()
  const existing = store.get(TRACKING_SID_COOKIE)?.value
  if (existing) return existing

  const sid = randomBytes(24).toString('base64url')
  store.set(TRACKING_SID_COOKIE, sid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TRACKING_SID_MAX_AGE,
  })
  return sid
}

/**
 * Read-only variant: returns the tracking session id if present, else null.
 * Use in routes/contexts where setting a cookie is not appropriate.
 */
export async function readTrackingSessionId(): Promise<string | null> {
  const store = await cookies()
  return store.get(TRACKING_SID_COOKIE)?.value ?? null
}
