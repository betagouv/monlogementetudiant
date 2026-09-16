import { z } from 'zod'

/**
 * Adresse e-mail normalisée (espaces retirés, minuscules) avant validation.
 *
 * Better Auth recherche les comptes en minuscules : une adresse enregistrée avec des majuscules ne
 * reçoit jamais de lien de connexion valide, et deux comptes ne différant que par la casse peuvent
 * coexister. Tout e-mail écrit en base par l'app doit passer par ce schéma.
 */
export const zNormalizedEmail = (message?: string) => z.string().trim().toLowerCase().pipe(z.email(message))
