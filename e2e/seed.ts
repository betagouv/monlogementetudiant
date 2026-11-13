/**
 * Seed de la base e2e (`mle_e2e` sur le conteneur db-test).
 *
 * Même jeu de données que la base de dev (src/__tests__/seed/dataset.ts), recréé à chaque exécution.
 * Lancer via : pnpm e2e:seed (env chargé depuis .env.e2e).
 */
import { runSeed } from '../src/__tests__/seed/run'

runSeed('e2e').catch((error) => {
  console.error('Échec du seed e2e :', error)
  process.exit(1)
})
