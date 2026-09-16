import { pbkdf2, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const pbkdf2Async = promisify(pbkdf2)

/** Plafond d'itérations accepté (les hashes hérités de Django sont à 600 000). */
const MAX_ITERATIONS = 1_000_000

/**
 * Vérifie un mot de passe contre un hash Django PBKDF2-SHA256 (`pbkdf2_sha256$<itérations>$<sel>$<hash_base64>`).
 * Asynchrone pour ne pas bloquer la boucle d'événements pendant le calcul.
 */
export async function verifyDjangoPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$')
  if (parts.length !== 4) return false

  const [algorithm, iterationsStr, salt, hash] = parts
  if (algorithm !== 'pbkdf2_sha256' || !salt || !hash) return false

  const iterations = Number(iterationsStr)
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) return false

  const expectedHash = Buffer.from(hash, 'base64')
  if (expectedHash.length === 0) return false

  const derived = await pbkdf2Async(password, salt, iterations, expectedHash.length, 'sha256')
  return timingSafeEqual(derived, expectedHash)
}
