import { z } from 'zod'

/**
 * État enregistré d'une tentative de connexion par lien e-mail (magic link).
 *
 * Seuls ces quatre états sont *écrits* : ils décrivent ce qui s'est réellement produit côté
 * serveur. L'état « lien expiré sans avoir été cliqué » n'est pas stocké — il se déduit d'un
 * `email_sent` dont la date d'expiration est passée (voir `ELoginOutcome`), ce qui évite une
 * tâche planifiée dont le seul rôle serait de réécrire des lignes.
 *
 * Doit rester synchronisé avec `loginAttemptStatusEnum` (src/server/db/schema/login-attempts.ts).
 */
export enum ELoginAttemptStatus {
  /** Le lien a été envoyé par e-mail, aucune vérification reçue pour l'instant. */
  EMAIL_SENT = 'email_sent',
  /** Le lien a été ouvert dans les temps : la session est créée, le gestionnaire est connecté. */
  COMPLETED = 'completed',
  /** Le lien a été ouvert après sa date d'expiration (10 minutes). */
  EXPIRED = 'expired',
  /** Jeton inconnu ou déjà consommé (lien rejoué, lien tronqué par le client mail…). */
  INVALID = 'invalid',
}

export const LOGIN_ATTEMPT_STATUSES = Object.values(ELoginAttemptStatus)

/**
 * Issue affichée dans l'espace administration. Reprend les états stockés en isolant le cas
 * « jamais cliqué », qui est de loin le plus parlant pour l'accompagnement des gestionnaires.
 */
export enum ELoginOutcome {
  /** Connexion aboutie. */
  COMPLETED = 'completed',
  /** Lien encore valide, pas encore ouvert : ni un succès ni un échec, juste trop tôt. */
  PENDING = 'pending',
  /** Lien expiré sans avoir jamais été ouvert. */
  NEVER_CLICKED = 'never_clicked',
  /** Lien ouvert trop tard. */
  EXPIRED = 'expired',
  /** Jeton inconnu ou déjà consommé. */
  INVALID = 'invalid',
}

export const LOGIN_OUTCOMES = Object.values(ELoginOutcome)

export const ZLoginOutcome = z.enum(ELoginOutcome)

export const LOGIN_OUTCOME_LABELS: Record<ELoginOutcome, string> = {
  [ELoginOutcome.COMPLETED]: 'Connexion aboutie',
  [ELoginOutcome.PENDING]: 'Lien envoyé, en attente',
  [ELoginOutcome.NEVER_CLICKED]: 'Lien jamais ouvert',
  [ELoginOutcome.EXPIRED]: 'Lien ouvert trop tard',
  [ELoginOutcome.INVALID]: 'Lien invalide ou déjà utilisé',
}

/** Issues qui méritent un avertissement : le gestionnaire a voulu se connecter et n'y est pas arrivé. */
export const FAILED_LOGIN_OUTCOMES = [ELoginOutcome.NEVER_CLICKED, ELoginOutcome.EXPIRED, ELoginOutcome.INVALID] as const

export const isFailedLoginOutcome = (outcome: ELoginOutcome): boolean =>
  (FAILED_LOGIN_OUTCOMES as readonly ELoginOutcome[]).includes(outcome)
