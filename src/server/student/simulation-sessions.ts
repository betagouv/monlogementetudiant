/**
 * Fenêtre de session des versions de simulation (budget, aides au logement) : une sauvegarde
 * dans les 20 minutes suivant la dernière modification met à jour la version en cours ;
 * au-delà, elle ouvre une nouvelle version. L'étudiant ne voit que la version la plus
 * récente ; l'historique reste en base pour les statistiques.
 */
export const SIMULATION_SESSION_WINDOW_MS = 20 * 60 * 1000

export const isWithinSessionWindow = (updatedAt: Date | null, now: Date) =>
  updatedAt !== null && now.getTime() - updatedAt.getTime() < SIMULATION_SESSION_WINDOW_MS
