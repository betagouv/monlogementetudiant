/**
 * Seed de la base de dev locale (`mle_dev` du service `db` de docker-compose).
 *
 * Lancer via : pnpm db:seed. Remplace TOUT le contenu de la base.
 *
 * L’env vient uniquement de `.env.dist` (valeurs factices, versionné) : seeder ne demande aucun `.env`
 * personnel. Le seed n’a besoin que de `DATABASE_URL`, mais le code de production qu’il rejoue valide
 * tout `src/server/env.ts` au chargement.
 */

// Les factories écrivent dans DATABASE_URL_TEST : on la fait pointer sur la base de dev
// avant de charger le lanceur : test-db lit cette variable à l'import (d'où l'import dynamique).
process.env.DATABASE_URL_TEST = process.env.DATABASE_URL

import('./run')
  .then(({ runSeed }) => runSeed('dev'))
  .catch((error) => {
    console.error('Échec du seed de dev :', error)
    process.exit(1)
  })
