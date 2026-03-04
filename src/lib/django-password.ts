import { pbkdf2Sync, timingSafeEqual } from 'crypto'

/**
 * Verifies a password against a Django PBKDF2-SHA256 hash.
 * Django stores passwords as: pbkdf2_sha256$<iterations>$<salt>$<hash_base64>
 */
export function verifyDjangoPassword(password: string, encoded: string): boolean {
  const parts = encoded.split('$')
  if (parts.length !== 4) return false

  const [algorithm, iterationsStr, salt, hash] = parts
  if (algorithm !== 'pbkdf2_sha256') return false

  const iterations = parseInt(iterationsStr, 10)
  if (isNaN(iterations)) return false

  const expectedHash = Buffer.from(hash, 'base64')
  const derived = pbkdf2Sync(password, salt, iterations, expectedHash.length, 'sha256')

  return timingSafeEqual(derived, expectedHash)
}
